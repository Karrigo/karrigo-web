import type { Metadata } from "next";

import {
  addStoreProduct,
  addStoreSection,
  appealStoreProductFlag,
  removeStoreProduct,
  removeStoreSection,
  saveStoreProduct,
  saveStoreSection,
  setStoreProductSoldOut,
  uploadStoreProductPhoto,
} from "@/app/(order)/my-store/actions";
import { MenuEditor, type MenuActions } from "@/components/kitchen/MenuEditor";
import { getStoreSections, requireStoreOwner } from "@/lib/store/data";

export const metadata: Metadata = { title: "Products · Your store · Karrigo" };

// The same editor as a kitchen's menu, pointed at the store's catalog.
const actions: MenuActions = {
  addDish: addStoreProduct,
  addSection: addStoreSection,
  appealFlag: appealStoreProductFlag,
  removeDish: removeStoreProduct,
  removeSection: removeStoreSection,
  saveDish: saveStoreProduct,
  saveSection: saveStoreSection,
  setSoldOut: setStoreProductSoldOut,
  uploadDishPhoto: uploadStoreProductPhoto,
};

export default async function StoreProductsPage() {
  const store = await requireStoreOwner();
  const sections = await getStoreSections();
  return (
    <MenuEditor
      kitchenName={store.name}
      sections={sections}
      servesFood={false}
      servesGrocery
      actions={actions}
    />
  );
}
