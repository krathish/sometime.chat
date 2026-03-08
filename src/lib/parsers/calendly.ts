import type { TimeSlot, ParseResult } from "./types";
import { extractCalendlySlug } from "./detect";

/**
 * Fetches availability from Calendly's internal booking API.
 * These are the same endpoints the public booking widget uses (no auth needed).
 * 
 * Flow:
 * 1. Fetch the booking page to extract the event type UUID
 * 2. Query the calendar/range endpoint for available slots
 */
export async function parseCalendly(url: string): Promise<ParseResult> {
  const slug = extractCalendlySlug(url);
  if (!slug) {
    return { platform: "calendly", slots: [], error: "Invalid Calendly URL" };
  }

  try {
    const profilePath = slug.eventType
      ? `${slug.username}/${slug.eventType}`
      : slug.username;

    const pageRes = await fetch(`https://calendly.com/${profilePath}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
    });

    if (!pageRes.ok) {
      return {
        platform: "calendly",
        slots: [],
        error: `Could not reach Calendly page (${pageRes.status})`,
      };
    }

    const html = await pageRes.text();

    const uuidMatch = html.match(
      /"uuid"\s*:\s*"([a-f0-9-]{36})"/
    );

    if (!uuidMatch) {
      return {
        platform: "calendly",
        slots: [],
        error: "Could not extract event type from Calendly page",
      };
    }

    const uuid = uuidMatch[1];
    const allSlots: TimeSlot[] = [];
    const today = new Date();

    for (let week = 0; week < 2; week++) {
      const start = new Date(today);
      start.setDate(start.getDate() + week * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      const rangeUrl = `https://calendly.com/api/booking/event_types/${uuid}/calendar/range?timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}&diagnostics=false&range_start=${startStr}&range_end=${endStr}`;

      const rangeRes = await fetch(rangeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });

      if (!rangeRes.ok) continue;

      const data = await rangeRes.json();

      if (data?.days) {
        for (const day of data.days) {
          if (day.status === "available" && day.spots) {
            for (const spot of day.spots) {
              if (spot.status === "available") {
                allSlots.push({
                  start: spot.start_time,
                  end:
                    spot.end_time ||
                    new Date(
                      new Date(spot.start_time).getTime() + 30 * 60000
                    ).toISOString(),
                });
              }
            }
          }
        }
      }
    }

    return { platform: "calendly", slots: allSlots };
  } catch (err) {
    return {
      platform: "calendly",
      slots: [],
      error: `Calendly parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
