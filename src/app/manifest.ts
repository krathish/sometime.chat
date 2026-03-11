import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sometime.Chat",
    short_name: "Sometime",
    description:
      "Connect your calendars and find overlapping free time. Supports Calendly, Cal.com, Google Calendar, and Notion Calendar.",
    start_url: "/",
    display: "standalone",
    background_color: "#2b8de8",
    theme_color: "#2b8de8",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
