import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links, invites } from "@/lib/db/schema";
import { parseAvailability, detectPlatform } from "@/lib/parsers";

interface ManualSlot {
  start: string;
  end: string;
}

function isValidIso(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function validateManualSlots(
  slots: unknown
): { valid: ManualSlot[] } | { error: string } {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { error: "slots must be a non-empty array" };
  }

  const validated: ManualSlot[] = [];
  for (const slot of slots) {
    if (
      !slot ||
      typeof slot !== "object" ||
      typeof (slot as ManualSlot).start !== "string" ||
      typeof (slot as ManualSlot).end !== "string"
    ) {
      return { error: "Each slot must have start and end strings" };
    }
    const { start, end } = slot as ManualSlot;
    if (!isValidIso(start) || !isValidIso(end)) {
      return { error: "Each slot must have valid ISO 8601 start and end" };
    }
    if (new Date(start) >= new Date(end)) {
      return { error: "Slot start must be before end" };
    }
    validated.push({ start, end });
  }

  return { valid: validated };
}

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
  const { url, personName, slots, timezone, inviteId } = body;

  if (!personName) {
    return NextResponse.json(
      { error: "personName is required" },
      { status: 400 }
    );
  }

  const linkId = nanoid(10);

  // Manual slots flow
  if (slots && !url) {
    const result = validateManualSlots(slots);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await db.insert(links).values({
      id: linkId,
      sessionId: id,
      url: "manual",
      personName,
      platform: "manual",
      timezone: timezone || null,
      availabilityJson: JSON.stringify(result.valid),
      parseError: null,
    });

    if (inviteId) {
      await markInviteJoined(inviteId, id);
    }

    return NextResponse.json(
      {
        id: linkId,
        url: "manual",
        personName,
        platform: "manual",
        slotsFound: result.valid.length,
        error: null,
      },
      { status: 201 }
    );
  }

  // URL parsing flow
  if (!url) {
    return NextResponse.json(
      { error: "url or slots are required" },
      { status: 400 }
    );
  }

  const platform = detectPlatform(url);
  const parseResult = await parseAvailability(url);

  await db.insert(links).values({
    id: linkId,
    sessionId: id,
    url,
    personName,
    platform,
    timezone: timezone || null,
    availabilityJson:
      parseResult.slots.length > 0
        ? JSON.stringify(parseResult.slots)
        : null,
    parseError: parseResult.error || null,
  });

  if (inviteId) {
    await markInviteJoined(inviteId, id);
  }

  return NextResponse.json(
    {
      id: linkId,
      url,
      personName,
      platform,
      slotsFound: parseResult.slots.length,
      error: parseResult.error || null,
    },
    { status: 201 }
  );
}

async function markInviteJoined(inviteId: string, sessionId: string) {
  try {
    const invite = await db.query.invites.findFirst({
      where: and(eq(invites.id, inviteId), eq(invites.sessionId, sessionId)),
    });
    if (invite && invite.status !== "joined") {
      await db
        .update(invites)
        .set({ status: "joined", joinedAt: new Date() })
        .where(eq(invites.id, inviteId));
    }
  } catch {
    // Non-critical — don't block link creation
  }
}
