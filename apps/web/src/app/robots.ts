import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-facts";

const origin = (process.env.NEXT_PUBLIC_SITE_URL || SITE.url).replace(/\/+$/, "");

/** The public site is one page. The app, the staff consoles, sign-in and the API are not for search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/login", "/admin", "/staff", "/doctor", "/nurse", "/dev", "/api"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
