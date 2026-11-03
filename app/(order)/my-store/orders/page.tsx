import type { Metadata } from "next";

import { setStoreOrderStatus } from "@/app/(order)/my-store/actions";
import { OrdersBoard } from "@/components/kitchen/OrdersBoard";
import { listStoreOrders, requireStore } from "@/lib/store/data";

export const metadata: Metadata = { title: "Orders · Your store · Karrigo" };

export default async function StoreOrdersPage() {
  const store = await requireStore();
  // A failure here goes to error.tsx, which offers a retry: an orders page
  // that quietly shows nothing would be worse than one that says it is stuck.
  const orders = await listStoreOrders();
  return <OrdersBoard orders={orders} isOpen={store.isOpen} onStatus={setStoreOrderStatus} place="store" />;
}
