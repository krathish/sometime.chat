import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Sometime.Chat",
  description: "See when everyone's free",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  other: {
    "theme-color": "#bec8d2",
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
        <meta name="theme-color" content="#bec8d2" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
      </body>
    </html>
  );
}
