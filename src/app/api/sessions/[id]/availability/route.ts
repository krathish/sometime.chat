import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links } from "@/lib/db/schema";
import { findCommonSlots, groupSlotsByDate } from "@/lib/availability";
import type { TimeSlot } from "@/lib/parsers/types";

export async function GET(
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

  const sessionLinks = await db.query.links.findMany({
    where: eq(links.sessionId, id),
  });

  const allSlots: TimeSlot[][] = [];
  const participants: { name: string; slotCount: number }[] = [];

  for (const link of sessionLinks) {
    if (link.availabilityJson) {
      const slots: TimeSlot[] = JSON.parse(link.availabilityJson);
      allSlots.push(slots);
      participants.push({ name: link.personName, slotCount: slots.length });
    }
  }

  if (allSlots.length === 0) {
    return NextResponse.json({
      commonSlots: [],
      grouped: {},
      participants,
      totalParticipants: sessionLinks.length,
      participantsWithAvailability: allSlots.length,
    });
  }

  const url = new URL(req.url);
  const tz =
    url.searchParams.get("timezone") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const common = findCommonSlots(allSlots);
  const grouped = groupSlotsByDate(common, tz);

  return NextResponse.json({
    commonSlots: common,
    grouped,
    participants,
    totalParticipants: sessionLinks.length,
    participantsWithAvailability: allSlots.length,
  });
}
