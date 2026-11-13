import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-facts";

const origin = (process.env.NEXT_PUBLIC_SITE_URL || SITE.url).replace(/\/+$/, "");

/** One public page. Add an entry here when the site gains another (a privacy notice, terms). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${origin}/`, changeFrequency: "weekly", priority: 1 }];
}
