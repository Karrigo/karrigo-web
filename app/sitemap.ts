import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/app-links";
import { listKitchens } from "@/lib/shop/catalog";

export const revalidate = 3600;

const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/kitchens", priority: 0.9 },
  { path: "/stores", priority: 0.8 },
  { path: "/areas", priority: 0.6 },
  { path: "/partners", priority: 0.6 },
  { path: "/help", priority: 0.5 },
  { path: "/contact", priority: 0.4 },
  { path: "/terms", priority: 0.2 },
  { path: "/privacy", priority: 0.2 },
  { path: "/delete-account", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A kitchen list that fails to load must not take the whole sitemap down.
  const kitchens = await listKitchens("FOOD").catch(() => []);
  return [
    ...PAGES.map(({ path, priority }) => ({ url: `${SITE_URL}${path}`, priority })),
    ...kitchens.map((k) => ({ url: `${SITE_URL}/k/${k.slug}`, priority: 0.7 })),
  ];
}
