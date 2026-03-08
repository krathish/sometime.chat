import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links } from "@/lib/db/schema";

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

  return NextResponse.json({
    ...session,
    links: sessionLinks.map((l) => ({
      ...l,
      availability: l.availabilityJson ? JSON.parse(l.availabilityJson) : null,
      error: l.parseError || null,
    })),
  });
}
