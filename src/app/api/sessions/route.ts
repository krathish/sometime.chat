import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export async function POST() {
  const id = nanoid(10);

  await db.insert(sessions).values({ id });

  return NextResponse.json({ id }, { status: 201 });
}
