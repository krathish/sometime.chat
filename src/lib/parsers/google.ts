import type { TimeSlot, ParseResult } from "./types";
import { classifyGoogleUrl } from "./detect";

const WORK_DAY_START_HOUR = 9;
const WORK_DAY_END_HOUR = 17;
const LOOKAHEAD_DAYS = 14;

/**
 * Parses Google Calendar links.
 *
 * Supports:
 * - Public ICS/iCal feeds (any URL ending in .ics, including Google Calendar exports)
 *   → parses VEVENT blocks, inverts busy times into free slots within working hours
 * - Google Calendar appointment booking pages
 *   → attempts to fetch embedded data; falls back with helpful message
 */
export async function parseGoogle(url: string): Promise<ParseResult> {
  const urlType = classifyGoogleUrl(url);

  if (urlType === "ics") {
    return parseIcsFeed(url);
  }

  if (urlType === "appointment") {
    return parseAppointmentPage(url);
  }

  return {
    platform: "google",
    slots: [],
    error:
      "Unrecognized Google Calendar link format. Try sharing your public ICS feed URL (Google Calendar → Settings → Calendar → Public address in iCal format).",
  };
}

async function parseIcsFeed(url: string): Promise<ParseResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/calendar, text/plain, */*",
      },
    });

    if (!res.ok) {
      return {
        platform: "google",
        slots: [],
        error: `Could not fetch calendar feed (${res.status}). Make sure the calendar is set to public.`,
      };
    }

    const icsText = await res.text();
    const events = parseIcsEvents(icsText);

    const now = new Date();
    const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000);

    const futureEvents = events.filter(
      (e) => e.end > now && e.start < horizon
    );

    const freeSlots = invertEventsToFreeSlots(futureEvents, now, horizon);

    return { platform: "google", slots: freeSlots };
  } catch (err) {
    return {
      platform: "google",
      slots: [],
      error: `ICS parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

async function parseAppointmentPage(url: string): Promise<ParseResult> {
  try {
    const finalUrl =
      url.includes("calendar.app.google") ? url : url;

    const res = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return {
        platform: "google",
        slots: [],
        error: `Could not reach Google Calendar page (${res.status})`,
      };
    }

    const html = await res.text();

    // Google appointment pages sometimes embed schedule data in script tags
    const dataMatch = html.match(
      /AF_initDataCallback\(\{[^}]*data:(\[[\s\S]*?\])\s*,\s*sideChannel/
    );

    if (dataMatch) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        const slots = extractSlotsFromGoogleData(parsed);
        if (slots.length > 0) {
          return { platform: "google", slots };
        }
      } catch {
        // data structure didn't match, fall through
      }
    }

    return {
      platform: "google",
      slots: [],
      error:
        "Could not extract availability from this Google Calendar booking page. Try sharing your public ICS feed instead (Google Calendar → Settings → your calendar → Public address in iCal format).",
    };
  } catch (err) {
    return {
      platform: "google",
      slots: [],
      error: `Google Calendar parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

interface CalEvent {
  start: Date;
  end: Date;
}

function parseIcsEvents(icsText: string): CalEvent[] {
  const events: CalEvent[] = [];
  const eventBlocks = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];

    const dtStart = extractIcsDateTime(block, "DTSTART");
    const dtEnd = extractIcsDateTime(block, "DTEND");

    if (dtStart && dtEnd) {
      events.push({ start: dtStart, end: dtEnd });
    }
  }

  return events;
}

function extractIcsDateTime(block: string, prop: string): Date | null {
  // Handles multiple formats:
  //   DTSTART:20260308T090000Z
  //   DTSTART;TZID=America/New_York:20260308T090000
  //   DTSTART;VALUE=DATE:20260308
  const regex = new RegExp(`${prop}[^:]*:([^\\r\\n]+)`);
  const match = block.match(regex);
  if (!match) return null;

  const val = match[1].trim();

  // All-day event (VALUE=DATE)
  if (/^\d{8}$/.test(val)) {
    const year = parseInt(val.slice(0, 4));
    const month = parseInt(val.slice(4, 6)) - 1;
    const day = parseInt(val.slice(6, 8));
    return new Date(Date.UTC(year, month, day));
  }

  // DateTime with Z (UTC)
  if (/^\d{8}T\d{6}Z$/.test(val)) {
    const year = parseInt(val.slice(0, 4));
    const month = parseInt(val.slice(4, 6)) - 1;
    const day = parseInt(val.slice(6, 8));
    const hour = parseInt(val.slice(9, 11));
    const min = parseInt(val.slice(11, 13));
    const sec = parseInt(val.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }

  // DateTime without Z (local or with TZID — treat as UTC for simplicity)
  if (/^\d{8}T\d{6}$/.test(val)) {
    const year = parseInt(val.slice(0, 4));
    const month = parseInt(val.slice(4, 6)) - 1;
    const day = parseInt(val.slice(6, 8));
    const hour = parseInt(val.slice(9, 11));
    const min = parseInt(val.slice(11, 13));
    const sec = parseInt(val.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }

  return null;
}

/**
 * Given a list of busy events, compute free slots within working hours
 * for each day in the [now, horizon] range.
 */
function invertEventsToFreeSlots(
  events: CalEvent[],
  now: Date,
  horizon: Date
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const startDay = new Date(now);
  startDay.setUTCHours(0, 0, 0, 0);

  for (let d = 0; d < LOOKAHEAD_DAYS; d++) {
    const day = new Date(startDay.getTime() + d * 86400000);
    const dayOfWeek = day.getUTCDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const workStart = new Date(day);
    workStart.setUTCHours(WORK_DAY_START_HOUR, 0, 0, 0);
    const workEnd = new Date(day);
    workEnd.setUTCHours(WORK_DAY_END_HOUR, 0, 0, 0);

    // Skip if work start is in the past
    const effectiveStart = workStart < now ? now : workStart;
    if (effectiveStart >= workEnd) continue;
    if (workEnd > horizon) continue;

    const dayEvents = sorted.filter(
      (e) => e.start < workEnd && e.end > effectiveStart
    );

    // Merge overlapping day events
    const merged = mergeEvents(dayEvents);

    let cursor = effectiveStart.getTime();
    for (const event of merged) {
      const eventStart = Math.max(event.start.getTime(), effectiveStart.getTime());
      if (cursor < eventStart) {
        freeSlots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(eventStart).toISOString(),
        });
      }
      cursor = Math.max(cursor, Math.min(event.end.getTime(), workEnd.getTime()));
    }

    if (cursor < workEnd.getTime()) {
      freeSlots.push({
        start: new Date(cursor).toISOString(),
        end: workEnd.toISOString(),
      });
    }
  }

  return freeSlots;
}

function mergeEvents(events: CalEvent[]): CalEvent[] {
  if (events.length <= 1) return events;
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  const merged: CalEvent[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = sorted[i].end > last.end ? sorted[i].end : last.end;
    } else {
      merged.push({ ...sorted[i] });
    }
  }

  return merged;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSlotsFromGoogleData(data: any[]): TimeSlot[] {
  const slots: TimeSlot[] = [];

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (typeof node === "string") {
      // Look for ISO date-like strings in the data tree
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(node)) {
        slots.push({
          start: node,
          end: new Date(new Date(node).getTime() + 30 * 60000).toISOString(),
        });
      }
    }
  }

  walk(data);
  return slots;
}
