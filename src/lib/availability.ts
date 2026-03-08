import type { TimeSlot } from "./parsers/types";

interface GroupedSlots {
  [date: string]: TimeSlot[];
}

/**
 * Finds time slots where ALL participants are available.
 * Works by computing pairwise intersections across all slot arrays.
 */
export function findCommonSlots(
  allParticipantSlots: TimeSlot[][]
): TimeSlot[] {
  if (allParticipantSlots.length === 0) return [];
  if (allParticipantSlots.length === 1) return allParticipantSlots[0];

  let common = mergeOverlapping(allParticipantSlots[0]);

  for (let i = 1; i < allParticipantSlots.length; i++) {
    const next = mergeOverlapping(allParticipantSlots[i]);
    common = intersectSlots(common, next);
    if (common.length === 0) break;
  }

  return common;
}

function intersectSlots(a: TimeSlot[], b: TimeSlot[]): TimeSlot[] {
  const result: TimeSlot[] = [];
  let i = 0;
  let j = 0;

  const sortedA = [...a].sort(
    (x, y) => new Date(x.start).getTime() - new Date(y.start).getTime()
  );
  const sortedB = [...b].sort(
    (x, y) => new Date(x.start).getTime() - new Date(y.start).getTime()
  );

  while (i < sortedA.length && j < sortedB.length) {
    const aStart = new Date(sortedA[i].start).getTime();
    const aEnd = new Date(sortedA[i].end).getTime();
    const bStart = new Date(sortedB[j].start).getTime();
    const bEnd = new Date(sortedB[j].end).getTime();

    const overlapStart = Math.max(aStart, bStart);
    const overlapEnd = Math.min(aEnd, bEnd);

    if (overlapStart < overlapEnd) {
      result.push({
        start: new Date(overlapStart).toISOString(),
        end: new Date(overlapEnd).toISOString(),
      });
    }

    if (aEnd < bEnd) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}

function mergeOverlapping(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length <= 1) return slots;

  const sorted = [...slots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const merged: TimeSlot[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (new Date(current.start).getTime() <= new Date(last.end).getTime()) {
      last.end =
        new Date(current.end) > new Date(last.end) ? current.end : last.end;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function groupSlotsByDate(
  slots: TimeSlot[],
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): GroupedSlots {
  const grouped: GroupedSlots = {};

  for (const slot of slots) {
    const date = new Date(slot.start).toLocaleDateString("en-CA", {
      timeZone: timezone,
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(slot);
  }

  return grouped;
}
