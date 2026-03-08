import type { Platform } from "./types";

export function detectPlatform(url: string): Platform {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    if (host === "calendly.com") return "calendly";
    if (host === "cal.com" || host.endsWith(".cal.com")) return "calcom";
    if (
      host === "calendar.google.com" ||
      host === "calendar.app.google" ||
      parsed.pathname.endsWith(".ics")
    )
      return "google";
    if (host === "calendar.notion.so") return "notion";

    return "unknown";
  } catch {
    return "unknown";
  }
}

export function classifyGoogleUrl(url: string): "ics" | "appointment" | "embed" {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith(".ics")) return "ics";
    if (
      parsed.pathname.includes("/calendar/appointments") ||
      parsed.hostname === "calendar.app.google"
    )
      return "appointment";
    return "embed";
  } catch {
    return "embed";
  }
}

export function extractCalendlySlug(url: string): {
  username: string;
  eventType: string;
} | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { username: parts[0], eventType: parts[1] };
    }
    if (parts.length === 1) {
      return { username: parts[0], eventType: "" };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractCalcomSlug(url: string): {
  username: string;
  eventType: string;
} | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { username: parts[0], eventType: parts[1] };
    }
    if (parts.length === 1) {
      return { username: parts[0], eventType: "" };
    }
    return null;
  } catch {
    return null;
  }
}
