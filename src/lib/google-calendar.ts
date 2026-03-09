import { google } from "googleapis";
import type { TimeSlot } from "./parsers/types";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const LOOKAHEAD_DAYS = 14;
const WORK_DAY_START_HOUR = 9;
const WORK_DAY_END_HOUR = 17;

export function getOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getAuthUrl(redirectUri: string, state: string): string {
  const client = getOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  });
}

export async function exchangeCode(code: string, redirectUri: string) {
  const client = getOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getUserInfo(accessToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return { email: data.email ?? null, name: data.name ?? null };
}

export async function fetchCalendarFreeSlots(
  accessToken: string,
  refreshToken?: string | null
): Promise<{ slots: TimeSlot[]; newAccessToken?: string }> {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });

  let newAccessToken: string | undefined;
  client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      newAccessToken = tokens.access_token;
    }
  });

  const calendar = google.calendar({ version: "v3", auth: client });

  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000);

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: horizon.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 500,
  });

  const busyEvents = (data.items || [])
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      start: new Date(e.start!.dateTime!),
      end: new Date(e.end!.dateTime!),
    }));

  const slots = invertToFreeSlots(busyEvents, now, horizon);
  return { slots, newAccessToken };
}

interface CalEvent {
  start: Date;
  end: Date;
}

function invertToFreeSlots(
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

    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const workStart = new Date(day);
    workStart.setUTCHours(WORK_DAY_START_HOUR, 0, 0, 0);
    const workEnd = new Date(day);
    workEnd.setUTCHours(WORK_DAY_END_HOUR, 0, 0, 0);

    const effectiveStart = workStart < now ? now : workStart;
    if (effectiveStart >= workEnd) continue;
    if (workEnd > horizon) continue;

    const dayEvents = sorted.filter(
      (e) => e.start < workEnd && e.end > effectiveStart
    );

    const merged = mergeEvents(dayEvents);

    let cursor = effectiveStart.getTime();
    for (const event of merged) {
      const eventStart = Math.max(
        event.start.getTime(),
        effectiveStart.getTime()
      );
      if (cursor < eventStart) {
        freeSlots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(eventStart).toISOString(),
        });
      }
      cursor = Math.max(
        cursor,
        Math.min(event.end.getTime(), workEnd.getTime())
      );
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

export function buildRedirectUri(requestUrl: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
  }
  const url = new URL(requestUrl);
  return `${url.origin}/api/auth/google/callback`;
}

export function encodeOAuthState(sessionId: string, personName: string, timezone?: string): string {
  return Buffer.from(JSON.stringify({ sessionId, personName, timezone })).toString(
    "base64url"
  );
}

export function decodeOAuthState(state: string): {
  sessionId: string;
  personName: string;
  timezone?: string;
} {
  return JSON.parse(Buffer.from(state, "base64url").toString());
}
