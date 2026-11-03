"use server";

import { cookies } from "next/headers";

import { SCOPES } from "@/lib/api/scopes";
import { listOrders } from "@/lib/kitchen/data";
import { listStoreOrders } from "@/lib/store/data";

/** An order waiting for a business to answer it. */
export type WaitingOrder = {
  side: "kitchen" | "store";
  id: string;
  code: string;
  area: string;
  subtotalKobo: number;
  itemCount: number;
};

/**
 * The unanswered orders on every side this browser is signed in to, for the
 * new-order toasts. A side with no session is not asked, and a side that
 * can't be read is left out rather than failing the other.
 */
export async function pollWaitingOrders(): Promise<WaitingOrder[]> {
  const jar = await cookies();
  const [kitchen, store] = await Promise.all([
    jar.get(SCOPES.kitchen.access)?.value ? listOrders().catch(() => []) : [],
    jar.get(SCOPES.store.access)?.value ? listStoreOrders().catch(() => []) : [],
  ]);
  const waiting = (side: WaitingOrder["side"], orders: Awaited<ReturnType<typeof listOrders>>): WaitingOrder[] =>
    orders
      .filter((o) => o.status === "PLACED")
      .map((o) => ({
        side,
        id: o.id,
        code: o.code,
        area: o.area,
        subtotalKobo: o.subtotalKobo,
        itemCount: o.items.reduce((n, i) => n + i.qty, 0),
      }));
  return [...waiting("kitchen", kitchen), ...waiting("store", store)];
}
