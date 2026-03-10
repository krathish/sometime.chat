import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, links } from "@/lib/db/schema";
import {
  findCommonSlots,
  groupSlotsByDate,
  computeAvailabilityLevels,
  groupLevelSlotsByDate,
} from "@/lib/availability";
import {
  computeSlotComfort,
  findGoldenHours,
  shortTimezoneLabel,
  type ParticipantTz,
} from "@/lib/timezone";
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
  const participantSlots: { name: string; slots: TimeSlot[] }[] = [];
  const participants: { name: string; slotCount: number; timezone: string | null; tzLabel: string | null }[] = [];
  const participantTimezones: ParticipantTz[] = [];

  const nameCounts = new Map<string, number>();
  for (const link of sessionLinks) {
    if (link.availabilityJson) {
      const count = (nameCounts.get(link.personName) ?? 0) + 1;
      nameCounts.set(link.personName, count);
    }
  }

  const nameIndices = new Map<string, number>();
  for (const link of sessionLinks) {
    if (link.availabilityJson) {
      const idx = (nameIndices.get(link.personName) ?? 0) + 1;
      nameIndices.set(link.personName, idx);
      const uniqueName =
        (nameCounts.get(link.personName) ?? 1) > 1
          ? `${link.personName} (${idx})`
          : link.personName;

      const slots: TimeSlot[] = JSON.parse(link.availabilityJson);
      allSlots.push(slots);
      participantSlots.push({ name: uniqueName, slots });
      participants.push({
        name: uniqueName,
        slotCount: slots.length,
        timezone: link.timezone,
        tzLabel: link.timezone ? shortTimezoneLabel(link.timezone) : null,
      });
      if (link.timezone) {
        participantTimezones.push({
          name: uniqueName,
          timezone: link.timezone,
        });
      }
    }
  }

  if (allSlots.length === 0) {
    return NextResponse.json({
      commonSlots: [],
      grouped: {},
      levelSlots: [],
      groupedLevels: {},
      participants,
      totalParticipants: sessionLinks.length,
      participantsWithAvailability: allSlots.length,
      timezoneInsights: null,
    });
  }

  const url = new URL(req.url);
  const tz =
    url.searchParams.get("timezone") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const common = findCommonSlots(allSlots);
  const grouped = groupSlotsByDate(common, tz);
  const levelSlots = computeAvailabilityLevels(participantSlots);
  const groupedLevels = groupLevelSlotsByDate(levelSlots, tz);

  let timezoneInsights = null;
  if (participantTimezones.length >= 2) {
    const goldenHours = findGoldenHours(participantTimezones);

    const slotComforts = levelSlots.map((slot) => ({
      start: slot.start,
      end: slot.end,
      comfort: computeSlotComfort(slot.start, participantTimezones),
    }));

    const uniqueTzCount = new Set(participantTimezones.map((p) => p.timezone)).size;

    timezoneInsights = {
      goldenHours,
      slotComforts,
      participantTimezones: participantTimezones.map((p) => ({
        name: p.name,
        timezone: p.timezone,
        label: shortTimezoneLabel(p.timezone),
      })),
      spansTzCount: uniqueTzCount,
    };
  }

  return NextResponse.json({
    commonSlots: common,
    grouped,
    levelSlots,
    groupedLevels,
    participants,
    totalParticipants: sessionLinks.length,
    participantsWithAvailability: allSlots.length,
    timezoneInsights,
  });
}
