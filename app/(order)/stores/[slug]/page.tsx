import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KitchenMenu } from "@/components/order/KitchenMenu";
import { SITE_URL } from "@/lib/app-links";
import { hasPartnerSession } from "@/lib/partners/data";
import { getStoreMenu } from "@/lib/shop/catalog";

/** Rendered fresh on every request: a store changes a price or sells out and
 *  the next person to open the page sees it. A store has its own page, apart
 *  from the kitchens', because its slug belongs to the store alone. */
export async function generateMetadata({ params }: PageProps<"/stores/[slug]">): Promise<Metadata> {
  const menu = await getStoreMenu((await params).slug);
  if (!menu) return { title: "Not found · Karrigo", robots: { index: false } };
  return {
    title: `${menu.name} · Karrigo`,
    description: `Order groceries from ${menu.name} in ${menu.area}, Makurdi. Live prices, delivered by a Karrigo rider.`,
  };
}

export default async function StorePage({ params }: PageProps<"/stores/[slug]">) {
  const [menu, partner] = await Promise.all([getStoreMenu((await params).slug), hasPartnerSession()]);
  if (!menu) notFound();
  const ld = {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    name: menu.name,
    url: `${SITE_URL}/stores/${menu.slug}`,
    ...(menu.imageUrl ? { image: menu.imageUrl } : {}),
    address: { "@type": "PostalAddress", addressLocality: "Makurdi", addressRegion: "Benue", addressCountry: "NG", streetAddress: menu.area },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <KitchenMenu menu={menu} browseOnly={partner} />
    </>
  );
}
