export interface TimeSlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export type Platform = "calendly" | "calcom" | "google" | "gcal" | "notion" | "manual" | "unknown";

export interface ParseResult {
  platform: Platform;
  slots: TimeSlot[];
  error?: string;
}
