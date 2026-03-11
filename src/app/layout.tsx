import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const perfectlyNineties = localFont({
  src: "./fonts/PerfectlyNineties-Regular.ttf",
  variable: "--font-perfectly-nineties",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2b8de8",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://sometime.chat"),
  title: {
    default: "Sometime.Chat",
    template: "%s – Sometime.Chat",
  },
  description:
    "Connect your calendars and find overlapping free time. Supports Calendly, Cal.com, Google Calendar, and Notion Calendar.",
  openGraph: {
    title: "Sometime.Chat",
    description: "Connect your calendars and find overlapping free time.",
    url: "https://sometime.chat",
    siteName: "Sometime.Chat",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sometime.Chat",
    description: "Connect your calendars and find overlapping free time.",
  },
  alternates: {
    canonical: "https://sometime.chat",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${perfectlyNineties.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              background: "linear-gradient(180deg, #f5f6f8 0%, #e6e9ed 100%)",
              border: "1px solid #8e99a4",
              boxShadow:
                "0 3px 12px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.1)",
              borderRadius: "10px",
              color: "#1a1a1a",
            },
          }}
        />
        <SpeedInsights />
      </body>
    </html>
  );
}
