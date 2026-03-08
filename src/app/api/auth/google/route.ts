import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import {
  getAuthUrl,
  buildRedirectUri,
  encodeOAuthState,
} from "@/lib/google-calendar";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const personName = url.searchParams.get("personName");

  if (!sessionId || !personName) {
    return NextResponse.json(
      { error: "sessionId and personName are required" },
      { status: 400 }
    );
  }

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    );
  }

  const timezone = url.searchParams.get("timezone") || undefined;
  const redirectUri = buildRedirectUri(req.url);
  const state = encodeOAuthState(sessionId, personName, timezone);
  const authUrl = getAuthUrl(redirectUri, state);

  return NextResponse.redirect(authUrl);
}
