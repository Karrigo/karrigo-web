import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/app-links";

/** Everything behind a login, or that only means something to one person. */
const PRIVATE = ["/checkout", "/orders", "/track", "/login", "/signup", "/my-kitchen", "/my-store", "/partners/", "/go/", "/api/"];

/** The ops and link hosts serve no public pages. Tell crawlers to stay out. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const closed = [process.env.ADMIN_HOST, process.env.LINK_HOST, "admin.localhost", "go.localhost"]
    .map((h) => h?.trim().toLowerCase())
    .filter(Boolean);
  if (closed.includes(host)) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
