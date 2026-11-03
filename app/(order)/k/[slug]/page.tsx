import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitchenMenu } from "@/components/order/KitchenMenu";
import { getPartner } from "@/lib/partners/data";
import { getKitchenMenu } from "@/lib/shop/catalog";
import { SITE_URL } from "@/lib/app-links";
import type { Side } from "@/lib/shop/types";

const sideOf = (type: string | string[] | undefined): Side => (type === "GROCERY" ? "GROCERY" : "FOOD");

/** Rendered fresh on every request: a kitchen changes a price or sells out
 *  and the next person to open the page sees it. `?type=GROCERY` opens the
 *  grocery side of a place that serves both. */
export async function generateMetadata({ params, searchParams }: PageProps<"/k/[slug]">): Promise<Metadata> {
  const menu = await getKitchenMenu((await params).slug, sideOf((await searchParams).type));
  if (!menu) return { title: "Not found · Karrigo", robots: { index: false } };
  const kind = menu.side === "GROCERY" ? "groceries" : `${menu.cuisine} food`;
  return {
    title: `${menu.name} · Karrigo`,
    description: `Order ${kind} from ${menu.name} in ${menu.area}, Makurdi. Live menu and prices, delivered by a Karrigo rider.`,
  };
}

export default async function KitchenPage({ params, searchParams }: PageProps<"/k/[slug]">) {
  const [menu, partner] = await Promise.all([
    getKitchenMenu((await params).slug, sideOf((await searchParams).type)),
    getPartner().catch(() => null),
  ]);
  if (!menu) notFound();
  const ld = {
    "@context": "https://schema.org",
    "@type": menu.side === "GROCERY" ? "GroceryStore" : "Restaurant",
    name: menu.name,
    url: `${SITE_URL}/k/${menu.slug}`,
    ...(menu.side === "FOOD" && menu.cuisine ? { servesCuisine: menu.cuisine } : {}),
    ...(menu.imageUrl ? { image: menu.imageUrl } : {}),
    address: { "@type": "PostalAddress", addressLocality: "Makurdi", addressRegion: "Benue", addressCountry: "NG", streetAddress: menu.area },
    ...(menu.ratingsCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: menu.rating, ratingCount: menu.ratingsCount } }
      : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <KitchenMenu menu={menu} browseOnly={partner !== null} />
    </>
  );
}
