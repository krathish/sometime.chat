import type { TimeSlot, ParseResult } from "./types";

const NOTION_API = "https://calendar-api.notion.so/v2/getHold";
const LOOKAHEAD_DAYS = 14;
const DEFAULT_SLOT_DURATION_MS = 30 * 60 * 1000;

/**
 * Fetches availability from Notion Calendar's internal API.
 *
 * URL format: https://calendar.notion.so/meet/:username/:alias
 *
 * The API returns large time-range blocks (e.g. 14:00–22:45 UTC).
 * We split those into individual slots using the meeting's configured
 * duration (defaults to 30 min if not specified in the response).
 */
export async function parseNotion(url: string): Promise<ParseResult> {
  const slug = extractNotionSlug(url);
  if (!slug) {
    return {
      platform: "notion",
      slots: [],
      error: "Invalid Notion Calendar URL. Expected format: calendar.notion.so/meet/username/id",
    };
  }

  try {
    const now = new Date();
    const timeMin = startOfDay(now).getTime();
    const timeMax =
      startOfDay(new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000)).getTime() - 1;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const res = await fetch(NOTION_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
        "x-timezone": tz,
        "x-notion-authenticated": "false",
        "x-client-type": "web",
      },
      body: JSON.stringify({
        username: slug.username,
        alias: slug.alias,
        timeMin,
        timeMax,
      }),
    });

    if (!res.ok) {
      return {
        platform: "notion",
        slots: [],
        error: `Notion Calendar API returned ${res.status}`,
      };
    }

    const data = await res.json();
    const hold = data?.hold;
    if (!hold) {
      return {
        platform: "notion",
        slots: [],
        error: "Could not find scheduling data in Notion Calendar response",
      };
    }

    const durationMs = hold.duration
      ? hold.duration * 60 * 1000
      : DEFAULT_SLOT_DURATION_MS;

    const timeRanges: { startDate: string; endDate: string }[] =
      hold.timeRanges || [];

    const allSlots: TimeSlot[] = [];

    for (const range of timeRanges) {
      const rangeStart = new Date(range.startDate).getTime();
      const rangeEnd = new Date(range.endDate).getTime();

      let cursor = rangeStart;
      while (cursor + durationMs <= rangeEnd) {
        allSlots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + durationMs).toISOString(),
        });
        cursor += durationMs;
      }
    }

    return { platform: "notion", slots: allSlots };
  } catch (err) {
    return {
      platform: "notion",
      slots: [],
      error: `Notion Calendar parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

function extractNotionSlug(
  url: string
): { username: string; alias: string } | null {
  try {
    const parsed = new URL(url);
    // Path: /meet/:username/:alias
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "meet" && parts.length >= 3) {
      return { username: parts[1], alias: parts[2] };
    }
    return null;
  } catch {
    return null;
  }
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
