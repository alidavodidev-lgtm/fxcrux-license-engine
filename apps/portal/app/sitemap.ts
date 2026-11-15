import type { MetadataRoute } from "next";

const BASE_URL = process.env.PORTAL_URL || "http://localhost:3001";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
