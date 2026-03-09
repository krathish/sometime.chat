import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links, calendarAccounts } from "@/lib/db/schema";
import {
  exchangeCode,
  getUserInfo,
  fetchCalendarFreeSlots,
  buildRedirectUri,
  decodeOAuthState,
} from "@/lib/google-calendar";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const { sessionId } = state
      ? decodeOAuthState(state)
      : { sessionId: "" };
    const redirectUrl = sessionId ? `/s/${sessionId}?gcal=denied` : "/";
    return NextResponse.redirect(new URL(redirectUrl, url.origin));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?gcal=error", url.origin));
  }

  let sessionId: string;
  let personName: string;
  let timezone: string | undefined;

  try {
    ({ sessionId, personName, timezone } = decodeOAuthState(state));
  } catch {
    return NextResponse.redirect(new URL("/?gcal=error", url.origin));
  }

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/?gcal=error", url.origin));
  }

  try {
    const redirectUri = buildRedirectUri(req.url);
    const tokens = await exchangeCode(code, redirectUri);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL(`/s/${sessionId}?gcal=error`, url.origin)
      );
    }

    const userInfo = await getUserInfo(tokens.access_token);
    const displayName = personName || userInfo.name || "Unknown";

    const { slots, newAccessToken } = await fetchCalendarFreeSlots(
      tokens.access_token,
      tokens.refresh_token
    );

    const linkId = nanoid(10);
    const calAccountId = nanoid(10);

    const emailLabel = userInfo.email ? ` (${userInfo.email})` : "";

    await db.insert(links).values({
      id: linkId,
      sessionId,
      url: `gcal://${userInfo.email || "connected"}`,
      personName: displayName,
      platform: "gcal",
      timezone: timezone || null,
      availabilityJson: slots.length > 0 ? JSON.stringify(slots) : null,
      parseError:
        slots.length === 0
          ? "No free slots found in the next 14 days (weekdays, 9AM\u20135PM UTC)"
          : null,
    });

    await db.insert(calendarAccounts).values({
      id: calAccountId,
      linkId,
      provider: "google",
      email: userInfo.email,
      accessToken: newAccessToken || tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    });

    const slotsMsg = slots.length > 0 ? slots.length : 0;
    return NextResponse.redirect(
      new URL(
        `/s/${sessionId}?gcal=success&slots=${slotsMsg}&name=${encodeURIComponent(displayName + emailLabel)}`,
        url.origin
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Google Calendar OAuth callback error:", message, err);
    return NextResponse.redirect(
      new URL(`/s/${sessionId}?gcal=error`, url.origin)
    );
  }
}
