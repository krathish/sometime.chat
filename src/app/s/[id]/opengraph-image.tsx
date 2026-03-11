import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export const runtime = "nodejs";
export const alt = "Sometime.Chat session";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  const title = session?.name
    ? `Add your time to ${session.name}`
    : "Find a time on Sometime.Chat";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #dfe4ea 0%, #bec8d2 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, #f5f6f8 0%, #e6e9ed 100%)",
            border: "1px solid #8e99a4",
            borderRadius: "20px",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.08)",
            padding: "60px 80px",
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "linear-gradient(180deg, #4a9eff 0%, #2670d6 100%)",
                boxShadow:
                  "0 2px 8px rgba(38,112,214,0.35), 0 0 0 0.5px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              S
            </div>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 600,
                color: "#4a5568",
                letterSpacing: "-0.01em",
              }}
            >
              Sometime.Chat
            </span>
          </div>

          <div
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "#1a1a1a",
              textAlign: "center",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              maxWidth: "800px",
            }}
          >
            {title}
          </div>

          <div
            style={{
              marginTop: "24px",
              fontSize: "22px",
              color: "#6b7280",
            }}
          >
            Connect calendars and find overlapping free time
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
