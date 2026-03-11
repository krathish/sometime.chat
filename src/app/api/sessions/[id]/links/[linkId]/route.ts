import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { links } from "@/lib/db/schema";
import { parseAvailability } from "@/lib/parsers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params;

  const deleted = await db
    .delete(links)
    .where(and(eq(links.id, linkId), eq(links.sessionId, id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
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

  const result = await parseAvailability(link.url);

  await db
    .update(links)
    .set({
      availabilityJson:
        result.slots.length > 0 ? JSON.stringify(result.slots) : null,
      parseError: result.error || null,
    })
    .where(eq(links.id, linkId));

  return NextResponse.json({
    id: linkId,
    slotsFound: result.slots.length,
    error: result.error || null,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params;
  const body = await req.json();
  const slots = body.slots;

  if (!Array.isArray(slots)) {
    return NextResponse.json(
      { error: "slots must be an array" },
      { status: 400 }
    );
  }

  const link = await db.query.links.findFirst({
    where: and(eq(links.id, linkId), eq(links.sessionId, id)),
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await db
    .update(links)
    .set({
      availabilityJson: slots.length > 0 ? JSON.stringify(slots) : null,
      parseError: null,
    })
    .where(eq(links.id, linkId));

  return NextResponse.json({
    id: linkId,
    slotsFound: slots.length,
  });
}
