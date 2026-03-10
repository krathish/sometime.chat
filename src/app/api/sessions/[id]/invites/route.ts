import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, invites } from "@/lib/db/schema";
import { sendInviteEmail } from "@/lib/email";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json();
  const rawEmails: unknown = body.emails;

  if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
    return NextResponse.json(
      { error: "emails must be a non-empty array" },
      { status: 400 }
    );
  }

  const emails = rawEmails
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter(isValidEmail);

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "No valid email addresses provided" },
      { status: 400 }
    );
  }

  const sessionName = session.name || "Untitled Session";
  const created: { id: string; email: string; status: string }[] = [];
  const errors: string[] = [];

  for (const email of emails) {
    const inviteId = nanoid(10);
    const inviteUrl = `${BASE_URL}/s/${id}?invite=${inviteId}`;

    await db.insert(invites).values({
      id: inviteId,
      sessionId: id,
      email,
      status: "sent",
    });

    try {
      await sendInviteEmail({ to: email, sessionName, inviteUrl });
      created.push({ id: inviteId, email, status: "sent" });
    } catch {
      errors.push(email);
    }
  }

  return NextResponse.json(
    { sent: created.length, failed: errors.length, invites: created, errors },
    { status: 201 }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sessionInvites = await db.query.invites.findMany({
    where: eq(invites.sessionId, id),
    orderBy: (invites, { desc }) => [desc(invites.sentAt)],
  });

  return NextResponse.json({ invites: sessionInvites });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { inviteId, status } = body;

  if (!inviteId || !status) {
    return NextResponse.json(
      { error: "inviteId and status are required" },
      { status: 400 }
    );
  }

  const invite = await db.query.invites.findFirst({
    where: and(eq(invites.id, inviteId), eq(invites.sessionId, id)),
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "opened" && !invite.openedAt) {
    updates.openedAt = new Date();
  }
  if (status === "joined") {
    updates.joinedAt = new Date();
  }

  await db.update(invites).set(updates).where(eq(invites.id, inviteId));

  return NextResponse.json({ ok: true });
}
