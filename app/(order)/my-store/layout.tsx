import type { Metadata } from "next";
import Link from "next/link";

import { LiveOrders } from "@/components/kitchen/LiveOrders";
import { Eyebrow } from "@/components/site/Eyebrow";
import { StoreTabs } from "@/components/store/StoreTabs";
import { listStoreOrders, requireStore } from "@/lib/store/data";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Where an approved store is run from: the door, the orders, the products.
 * `requireStore()` is the gate; each page calls it again, because a layout
 * is not re-run on every navigation.
 */
export default async function StoreConsoleLayout({ children }: { children: React.ReactNode }) {
  const store = await requireStore();
  // The bell is a convenience. If the orders can't be read, the orders page
  // says so itself; the rest of the console should still open.
  const orders = await listStoreOrders().catch(() => []);
  const waitingIds = orders.filter((o) => o.status === "PLACED").map((o) => o.id);

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="gap-md flex flex-wrap items-center justify-between">
        <Eyebrow>{store.isOpen ? "Open now" : "Closed"}</Eyebrow>
        <LiveOrders waitingIds={waitingIds} />
      </div>
      <div className="gap-md mt-md flex flex-wrap items-end justify-between">
        <h1 className="text-section-small md:text-section text-balance">{store.name}</h1>
        <Link href={`/stores/${store.slug}`} className="text-accent-text text-site-label pb-sm font-bold">
          See your page as a customer
        </Link>
      </div>
      <div className="mt-lg mb-xl">
        <StoreTabs owner={store.role === "OWNER"} waiting={waitingIds.length} />
      </div>
      {children}
    </div>
  );
}
