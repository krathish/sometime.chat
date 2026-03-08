import { detectPlatform } from "./detect";
import { parseCalendly } from "./calendly";
import { parseCalcom } from "./calcom";
import { parseGoogle } from "./google";
import { parseNotion } from "./notion";
import type { ParseResult } from "./types";

export { detectPlatform } from "./detect";
export type { TimeSlot, Platform, ParseResult } from "./types";

export async function parseAvailability(url: string): Promise<ParseResult> {
  const platform = detectPlatform(url);

  switch (platform) {
    case "calendly":
      return parseCalendly(url);
    case "calcom":
      return parseCalcom(url);
    case "google":
      return parseGoogle(url);
    case "notion":
      return parseNotion(url);
    default:
      return {
        platform: "unknown",
        slots: [],
        error:
          "Unsupported platform. Currently supports Calendly, Cal.com, Google Calendar, and Notion Calendar links.",
      };
  }
}
