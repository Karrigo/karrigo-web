import type { Metadata } from "next";
import { KitchensBrowser } from "@/components/order/KitchensBrowser";
import { getActiveCategories } from "@/lib/categories-data";
import { resolveCategoryParam } from "@/lib/category-filter";
import { listKitchens } from "@/lib/shop/catalog";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = {
  title: "Order groceries in Makurdi · Karrigo",
  description: "Groceries from stores in Makurdi, delivered by a Karrigo rider to your landmark.",
};

/** A failed filtered fetch must not read as "no stores in this category", so it comes back as null. An unfiltered failure still throws to the page's error screen. */
async function listStoresOrNull(categoryId: string | undefined) {
  if (!categoryId) return listKitchens("GROCERY");
  try {
    return await listKitchens("GROCERY", categoryId);
  } catch {
    return null;
  }
}

export default async function StoresPage({ searchParams }: PageProps<"/stores">) {
  const categories = await getActiveCategories("GROCERY");
  const categoryId = resolveCategoryParam((await searchParams).category, categories);
  const [stores, customer] = await Promise.all([listStoresOrNull(categoryId), getCustomer()]);
  return (
    <KitchensBrowser
      kitchens={stores ?? []}
      loadFailed={stores === null}
      categories={categories}
      categoryId={categoryId}
      side="GROCERY"
      firstName={customer?.name.split(" ")[0] || null}
    />
  );
}
