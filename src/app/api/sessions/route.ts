import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

const CODE_CHARS = "0123456789";

function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

const SESSION_NAMES = [
  "Boom Boom", "Chit Chat", "Hobnob", "Huddle Up", "Jam Sesh",
  "Riff Raff", "Wham Bam", "Hoo Ha", "Kerfuffle", "Shindig",
];

function generateFunName(): string {
  return SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)];
}

export async function POST() {
  const id = nanoid(10);
  const code = generateCode();
  const name = generateFunName();

  await db.insert(sessions).values({ id, code, name });

  return NextResponse.json({ id, code, name }, { status: 201 });
}
