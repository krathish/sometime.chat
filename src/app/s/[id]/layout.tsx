import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  const title = session?.name ?? "Session";
  const description = session?.name
    ? `Add your time to ${session.name} on Sometime.Chat`
    : "Find a time on Sometime.Chat";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: session?.name
        ? `Add your time to ${session.name}`
        : "Find a time on Sometime.Chat",
      description: "Connect calendars and find overlapping free time",
      siteName: "Sometime.Chat",
    },
  };
}

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
