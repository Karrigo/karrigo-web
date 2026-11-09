import type { Metadata } from "next";
import { KitchensBrowser } from "@/components/order/KitchensBrowser";
import { getActiveCategories } from "@/lib/categories-data";
import { resolveCategoryParam } from "@/lib/category-filter";
import { listKitchens } from "@/lib/shop/catalog";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = {
  title: "Order food in Makurdi · Karrigo",
  description: "Browse kitchens in Makurdi, see live menus and prices, and have a Karrigo rider bring your food to your landmark.",
};

/** A failed filtered fetch must not read as "no kitchens in this category", so it comes back as null. An unfiltered failure still throws to the page's error screen. */
async function listKitchensOrNull(categoryId: string | undefined) {
  if (!categoryId) return listKitchens("FOOD");
  try {
    return await listKitchens("FOOD", categoryId);
  } catch {
    return null;
  }
}

export default async function KitchensPage({ searchParams }: PageProps<"/kitchens">) {
  const categories = await getActiveCategories("FOOD");
  const categoryId = resolveCategoryParam((await searchParams).category, categories);
  const [kitchens, customer] = await Promise.all([listKitchensOrNull(categoryId), getCustomer()]);
  return (
    <KitchensBrowser
      kitchens={kitchens ?? []}
      loadFailed={kitchens === null}
      categories={categories}
      categoryId={categoryId}
      firstName={customer?.name.split(" ")[0] || null}
    />
  );
}
