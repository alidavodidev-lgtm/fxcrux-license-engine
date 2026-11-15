import type { MetadataRoute } from "next";

const BASE_URL = process.env.PORTAL_URL || "http://localhost:3001";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Only the public sign-in/register screen is worth crawling - everything
        // past it needs a session cookie a crawler can never obtain, so there's
        // no SEO value (and no harm) in leaving those paths open too.
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/dashboard", "/store", "/licenses", "/billing", "/profile", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
