import type { Metadata } from "next";

import { MenuEditor } from "@/components/kitchen/MenuEditor";
import { getActiveCategories } from "@/lib/categories-data";
import { requireKitchen } from "@/lib/kitchen/data";

export const metadata: Metadata = { title: "Menu · Your kitchen · Karrigo" };

export default async function KitchenMenuPage() {
  const [kitchen, categories] = await Promise.all([requireKitchen(), getActiveCategories()]);
  return <MenuEditor
      categories={categories}
      kitchenName={kitchen.name}
      sections={kitchen.sections}
      servesFood={kitchen.servesFood}
      servesGrocery={kitchen.servesGrocery}
    />;
}
