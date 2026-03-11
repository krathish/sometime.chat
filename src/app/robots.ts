import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/s/"],
      },
    ],
    sitemap: "https://sometime.chat/sitemap.xml",
  };
}
