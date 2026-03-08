/**
 * Timezone intelligence: comfort scoring, golden-hour computation,
 * and per-participant local-time helpers.
 *
 * Comfort tiers (local hour):
 *   09–17  1.0   core work hours
 *   08     0.7   early morning
 *   17–18  0.9   late afternoon
 *   18–20  0.7   evening
 *   07     0.3   very early
 *   20–22  0.4   late evening
 *   22–07  0.0   sleeping
 */

export interface ParticipantTz {
  name: string;
  timezone: string;
}

export interface SlotComfort {
  overallScore: number;
  perParticipant: {
    name: string;
    timezone: string;
    localTime: string;
    hour: number;
    score: number;
    label: "great" | "ok" | "early" | "late" | "bad";
  }[];
}

export interface GoldenHourWindow {
  startUtcHour: number;
  endUtcHour: number;
  widthHours: number;
}

function hourComfort(h: number): { score: number; label: "great" | "ok" | "early" | "late" | "bad" } {
  if (h >= 9 && h < 17) return { score: 1.0, label: "great" };
  if (h >= 17 && h < 18) return { score: 0.9, label: "great" };
  if (h === 8) return { score: 0.7, label: "ok" };
  if (h >= 18 && h < 20) return { score: 0.7, label: "ok" };
  if (h === 7) return { score: 0.3, label: "early" };
  if (h >= 20 && h < 22) return { score: 0.4, label: "late" };
  return { score: 0.0, label: "bad" };
}

export function getLocalHour(utcIso: string, timezone: string): number {
  const d = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : d.getUTCHours();
}

export function formatLocalTime(utcIso: string, timezone: string): string {
  return new Date(utcIso).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function computeSlotComfort(
  slotStartUtc: string,
  participants: ParticipantTz[]
): SlotComfort {
  if (participants.length === 0) {
    return { overallScore: 1, perParticipant: [] };
  }

  const perParticipant = participants.map((p) => {
    const hour = getLocalHour(slotStartUtc, p.timezone);
    const { score, label } = hourComfort(hour);
    return {
      name: p.name,
      timezone: p.timezone,
      localTime: formatLocalTime(slotStartUtc, p.timezone),
      hour,
      score,
      label,
    };
  });

  const overallScore = Math.min(...perParticipant.map((p) => p.score));
  return { overallScore, perParticipant };
}

/**
 * Finds the "golden hours" window — the UTC hour range where all
 * participants are within reasonable hours (8 AM – 8 PM local).
 *
 * Returns null if no overlap exists (timezones too far apart).
 */
export function findGoldenHours(
  participants: ParticipantTz[]
): GoldenHourWindow | null {
  if (participants.length === 0) return null;

  const REASONABLE_START = 8;
  const REASONABLE_END = 20;

  const utcWindows = participants.map((p) => {
    const offset = getTimezoneOffsetHours(p.timezone);
    const startUtc = ((REASONABLE_START - offset) % 24 + 24) % 24;
    const endUtc = ((REASONABLE_END - offset) % 24 + 24) % 24;
    return { startUtc, endUtc };
  });

  let overlapStart = utcWindows[0].startUtc;
  let overlapEnd = utcWindows[0].endUtc;

  for (let i = 1; i < utcWindows.length; i++) {
    const w = utcWindows[i];
    const result = intersectCircularRanges(
      overlapStart,
      overlapEnd,
      w.startUtc,
      w.endUtc
    );
    if (!result) return null;
    overlapStart = result.start;
    overlapEnd = result.end;
  }

  const width =
    overlapEnd > overlapStart
      ? overlapEnd - overlapStart
      : 24 - overlapStart + overlapEnd;

  if (width <= 0 || width > 23) return null;

  return {
    startUtcHour: overlapStart,
    endUtcHour: overlapEnd,
    widthHours: width,
  };
}

function intersectCircularRanges(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): { start: number; end: number } | null {
  const aSet = expandRange(aStart, aEnd);
  const bSet = expandRange(bStart, bEnd);
  const common = aSet.filter((h) => bSet.includes(h));
  if (common.length === 0) return null;

  const sorted = [...common].sort((a, b) => a - b);
  let bestStart = sorted[0];
  let bestLen = 1;
  let curStart = sorted[0];
  let curLen = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      curLen++;
    } else {
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = sorted[i];
      curLen = 1;
    }
  }
  if (curLen > bestLen) {
    bestStart = curStart;
    bestLen = curLen;
  }

  if (
    sorted[sorted.length - 1] === 23 &&
    sorted[0] === 0 &&
    bestStart === 0
  ) {
    let wrapLen = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] === 23 - (sorted.length - 1 - i)) wrapLen++;
      else break;
    }
    if (wrapLen + bestLen > bestLen) {
      bestStart = sorted[sorted.length - wrapLen];
      bestLen = wrapLen + bestLen;
    }
  }

  return { start: bestStart % 24, end: (bestStart + bestLen) % 24 };
}

function expandRange(start: number, end: number): number[] {
  const hours: number[] = [];
  if (start < end) {
    for (let h = start; h < end; h++) hours.push(h);
  } else {
    for (let h = start; h < 24; h++) hours.push(h);
    for (let h = 0; h < end; h++) hours.push(h);
  }
  return hours;
}

function getTimezoneOffsetHours(timezone: string): number {
  const now = new Date();
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const localStr = now.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const localDate = new Date(localStr);
  return (localDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
}

export function shortTimezoneLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || timezone.split("/").pop()?.replace(/_/g, " ") || timezone;
  } catch {
    return timezone;
  }
}

export function comfortColor(score: number): {
  bg: string;
  text: string;
  border: string;
  emoji: string;
} {
  if (score >= 0.9) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", emoji: "" };
  if (score >= 0.7) return { bg: "bg-emerald-50/60", text: "text-emerald-600", border: "border-emerald-200/60", emoji: "" };
  if (score >= 0.3) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", emoji: "" };
  return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", emoji: "" };
}
