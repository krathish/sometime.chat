import type { TimeSlot, ParseResult } from "./types";
import { extractCalcomSlug } from "./detect";

/**
 * Fetches availability from Cal.com's public slots API.
 * The booking page uses this same endpoint without authentication.
 */
export async function parseCalcom(url: string): Promise<ParseResult> {
  const slug = extractCalcomSlug(url);
  if (!slug) {
    return { platform: "calcom", slots: [], error: "Invalid Cal.com URL" };
  }

  try {
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const endDate = new Date(today.getTime() + 14 * 86400000)
      .toISOString()
      .split("T")[0];

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const eventSlug = slug.eventType || "30min";

    const apiUrl = `https://cal.com/api/trpc/public/slots.getSchedule?input=${encodeURIComponent(
      JSON.stringify({
        json: {
          isTeamEvent: false,
          usernameList: [slug.username],
          eventTypeSlug: eventSlug,
          startTime: `${startDate}T00:00:00.000Z`,
          endTime: `${endDate}T23:59:59.999Z`,
          timeZone: tz,
          duration: null,
          rescheduleUid: null,
          orgSlug: null,
        },
        meta: { values: { duration: ["undefined"], rescheduleUid: ["undefined"], orgSlug: ["undefined"] } },
      })
    )}`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return {
        platform: "calcom",
        slots: [],
        error: `Cal.com API returned ${res.status}`,
      };
    }

    const data = await res.json();
    const allSlots: TimeSlot[] = [];

    const slotsData = data?.result?.data?.json?.slots;
    if (slotsData && typeof slotsData === "object") {
      for (const dateKey of Object.keys(slotsData)) {
        const daySlots = slotsData[dateKey];
        if (Array.isArray(daySlots)) {
          for (const slot of daySlots) {
            const startTime = slot.time || slot.start;
            if (startTime) {
              allSlots.push({
                start: startTime,
                end:
                  slot.endTime ||
                  slot.end ||
                  new Date(
                    new Date(startTime).getTime() + 30 * 60000
                  ).toISOString(),
              });
            }
          }
        }
      }
    }

    return { platform: "calcom", slots: allSlots };
  } catch (err) {
    return {
      platform: "calcom",
      slots: [],
      error: `Cal.com parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
