import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links, calendarAccounts, invites } from "@/lib/db/schema";
import { shortTimezoneLabel } from "@/lib/timezone";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionLinks = await db.query.links.findMany({
    where: eq(links.sessionId, id),
    orderBy: (links, { asc }) => [asc(links.createdAt)],
  });

  const calAccounts = await db.query.calendarAccounts.findMany({
    where: eq(calendarAccounts.provider, "google"),
  });
  const calAccountsByLink = new Map(calAccounts.map((a) => [a.linkId, a]));

  const sessionInvites = await db.query.invites.findMany({
    where: eq(invites.sessionId, id),
    orderBy: (invites, { desc }) => [desc(invites.sentAt)],
  });

  return NextResponse.json({
    ...session,
    links: sessionLinks.map((l) => {
      const calAccount = calAccountsByLink.get(l.id);
      return {
        ...l,
        availability: l.availabilityJson
          ? JSON.parse(l.availabilityJson)
          : null,
        error: l.parseError || null,
        calendarEmail: calAccount?.email ?? null,
        canRefresh: l.platform === "gcal" && !!calAccount,
        timezone: l.timezone ?? null,
        tzLabel: l.timezone ? shortTimezoneLabel(l.timezone) : null,
      };
    }),
    invites: sessionInvites,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await db.update(sessions).set({ name }).where(eq(sessions.id, id));

  return NextResponse.json({ ok: true, name });
}
