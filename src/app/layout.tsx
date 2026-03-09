import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FreeTime",
  description: "Find common free time across scheduling links",
  other: {
    "theme-color": "#d4d0c8",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#d4d0c8" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              background: "#ececec",
              border: "1px solid #a0a0a0",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
              borderRadius: "8px",
              color: "#1a1a1a",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}
