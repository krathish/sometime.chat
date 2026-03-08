import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { links, calendarAccounts } from "@/lib/db/schema";
import { fetchCalendarFreeSlots } from "@/lib/google-calendar";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params;

  const link = await db.query.links.findFirst({
    where: and(eq(links.id, linkId), eq(links.sessionId, id)),
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (link.platform !== "gcal") {
    return NextResponse.json(
      { error: "Only Google Calendar links can be refreshed" },
      { status: 400 }
    );
  }

  const account = await db.query.calendarAccounts.findFirst({
    where: eq(calendarAccounts.linkId, linkId),
  });

  if (!account) {
    return NextResponse.json(
      { error: "No calendar account found. Please reconnect Google Calendar." },
      { status: 400 }
    );
  }

  try {
    const { slots, newAccessToken } = await fetchCalendarFreeSlots(
      account.accessToken,
      account.refreshToken
    );

    await db
      .update(links)
      .set({
        availabilityJson:
          slots.length > 0 ? JSON.stringify(slots) : null,
        parseError:
          slots.length === 0
            ? "No free slots found in the next 14 days (weekdays, 9AM\u20135PM UTC)"
            : null,
      })
      .where(eq(links.id, linkId));

    if (newAccessToken) {
      await db
        .update(calendarAccounts)
        .set({ accessToken: newAccessToken })
        .where(eq(calendarAccounts.id, account.id));
    }

    return NextResponse.json({
      id: linkId,
      slotsFound: slots.length,
      error: slots.length === 0
        ? "No free slots found in the next 14 days"
        : null,
    });
  } catch (err) {
    console.error("Calendar refresh error:", err);

    const isAuthError =
      err instanceof Error &&
      (err.message.includes("invalid_grant") ||
        err.message.includes("Token has been expired") ||
        err.message.includes("401"));

    if (isAuthError) {
      return NextResponse.json(
        {
          error: "Google Calendar access has expired. Please reconnect.",
          reconnect: true,
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to refresh calendar data" },
      { status: 500 }
    );
  }
}
