import { google } from "googleapis";
import type { TimeSlot } from "./parsers/types";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const LOOKAHEAD_DAYS = 14;
const WINDOW_START_HOUR = 6;
const WINDOW_END_HOUR = 24;

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
  refreshToken?: string | null,
  timezone?: string | null
): Promise<{ slots: TimeSlot[]; busySlots: TimeSlot[]; newAccessToken?: string }> {
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

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: horizon.toISOString(),
      items: [{ id: "primary" }],
    },
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const busyPeriods = (data.calendars?.primary?.busy || [])
    .filter((b) => b.start && b.end)
    .map((b) => ({
      start: new Date(b.start!),
      end: new Date(b.end!),
    }))
    .filter((b) => b.end.getTime() - b.start.getTime() < DAY_MS);

  const tz = timezone || "UTC";
  const busySlots = clipToWindow(busyPeriods, now, horizon, tz);

  return { slots: [], busySlots, newAccessToken };
}

interface CalEvent {
  start: Date;
  end: Date;
}

function computeOffsetMs(refDate: Date, tz: string): number {
  const utcStr = refDate.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = refDate.toLocaleString("en-US", { timeZone: tz });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}

function getDayWindow(
  dateStr: string,
  tz: string
): { windowStart: Date; windowEnd: Date } {
  const startRef = new Date(
    `${dateStr}T${String(WINDOW_START_HOUR).padStart(2, "0")}:00:00Z`
  );
  const windowHours = WINDOW_END_HOUR - WINDOW_START_HOUR;
  const endRef = new Date(startRef.getTime() + windowHours * 3600000);

  const offset = computeOffsetMs(startRef, tz);

  return {
    windowStart: new Date(startRef.getTime() - offset),
    windowEnd: new Date(endRef.getTime() - offset),
  };
}

function iterateDays(now: Date, tz: string): string[] {
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const startDay = new Date(todayStr + "T00:00:00Z");
  const dates: string[] = [];
  for (let d = 0; d < LOOKAHEAD_DAYS; d++) {
    const day = new Date(startDay);
    day.setUTCDate(day.getUTCDate() + d);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

function clipToWindow(
  events: CalEvent[],
  now: Date,
  horizon: Date,
  tz: string
): TimeSlot[] {
  const clipped: TimeSlot[] = [];

  for (const dateStr of iterateDays(now, tz)) {
    const { windowStart, windowEnd } = getDayWindow(dateStr, tz);

    const effectiveStart = windowStart < now ? now : windowStart;
    if (effectiveStart >= windowEnd) continue;
    if (windowEnd > horizon) continue;

    for (const event of events) {
      const visStart = Math.max(
        event.start.getTime(),
        effectiveStart.getTime()
      );
      const visEnd = Math.min(event.end.getTime(), windowEnd.getTime());
      if (visStart >= visEnd) continue;

      clipped.push({
        start: new Date(visStart).toISOString(),
        end: new Date(visEnd).toISOString(),
      });
    }
  }

  return clipped;
}

export function buildRedirectUri(requestUrl: string): string {
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
