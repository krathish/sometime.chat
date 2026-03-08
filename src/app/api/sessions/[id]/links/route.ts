import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links } from "@/lib/db/schema";
import { parseAvailability, detectPlatform } from "@/lib/parsers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json();
  const { url, personName } = body;

  if (!url || !personName) {
    return NextResponse.json(
      { error: "url and personName are required" },
      { status: 400 }
    );
  }

  const platform = detectPlatform(url);
  const result = await parseAvailability(url);

  const linkId = nanoid(10);

  await db.insert(links).values({
    id: linkId,
    sessionId: id,
    url,
    personName,
    platform,
    availabilityJson:
      result.slots.length > 0 ? JSON.stringify(result.slots) : null,
    parseError: result.error || null,
  });

  return NextResponse.json(
    {
      id: linkId,
      url,
      personName,
      platform,
      slotsFound: result.slots.length,
      error: result.error || null,
    },
    { status: 201 }
  );
}
