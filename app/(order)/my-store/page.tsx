import type { Metadata } from "next";
import Link from "next/link";

import { Door, Notice } from "@/components/kitchen/Door";
import { panel } from "@/components/kitchen/parts";
import { SetupChecklist } from "@/components/kitchen/SetupChecklist";
import { saveStoreNotice, setStoreOpen } from "@/app/(order)/my-store/actions";
import { STORE_APPLICATION, getStoreSections, listStoreOrders, requireStore } from "@/lib/store/data";

export const metadata: Metadata = { title: "Your store · Karrigo" };

export default async function StoreTodayPage() {
  const store = await requireStore();
  const owner = store.role === "OWNER";
  const orders = await listStoreOrders().catch(() => null);
  // The catalog is the owner's to read; staff just don't see the product tiles.
  const products = owner ? await getStoreSections().then((s) => s.flatMap((x) => x.dishes)).catch(() => null) : null;

  const count = (...statuses: string[]) => orders?.filter((o) => statuses.includes(o.status)).length ?? 0;

  // What stops the store opening. Only the owner can fix either.
  const todo = owner
    ? [
        ...(store.missing.includes("LOCATION")
          ? [{ label: "Set your store's location", href: `${STORE_APPLICATION}#location` }]
          : []),
        ...(store.missing.includes("RIDER_FEE")
          ? [{ label: "Set the rider base delivery fee", href: "/my-store/settings#rider-fee" }]
          : []),
      ]
    : [];

  const tiles = [
    { label: "New orders", value: count("PLACED"), href: "/my-store/orders" },
    { label: "Being packed", value: count("ACCEPTED", "PREPARING"), href: "/my-store/orders" },
    { label: "Waiting for a rider", value: count("READY"), href: "/my-store/orders" },
    ...(products ? [{ label: "Products sold out", value: products.filter((p) => p.soldOut).length, href: "/my-store/products" }] : []),
  ];

  return (
    <div className="gap-lg flex flex-col">
      <SetupChecklist items={todo} />

      <Door name={store.name} isOpen={store.isOpen} canSwitch={owner} onSetOpen={setStoreOpen} place="store" />

      {products !== null && products.length === 0 && (
        <div className="bg-warning-bg rounded-panel-sm p-xl">
          <p className="text-warning text-site-title">{store.name} has nothing on the shelves</p>
          <p className="text-site-body text-text-secondary mt-xs">
            Customers can open your page but there is nothing to order.{" "}
            <Link href="/my-store/products" className="text-accent-text font-bold">
              Add your products
            </Link>
          </p>
        </div>
      )}

      {orders === null ? (
        <div className={panel}>
          <p className="text-site-title">We couldn&rsquo;t load your orders just now</p>
          <p className="text-site-body text-text-secondary mt-xs">
            Check your connection, then open the{" "}
            <Link href="/my-store/orders" className="text-accent-text font-bold">
              Orders tab
            </Link>{" "}
            to try again.
          </p>
        </div>
      ) : (
        <ul className="gap-md grid grid-cols-2 md:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.label}>
              <Link href={t.href} className="bg-bg rounded-panel-sm hover:bg-surface-raised block h-full p-xl transition-colors duration-(--duration-fast)">
                <span className="text-panel-small block">{t.value}</span>
                <span className="text-site-label text-text-secondary mt-xs block">{t.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {owner && <Notice notice={store.notice} onSave={saveStoreNotice} />}

      {owner && (
        <p className="text-site-label text-text-secondary">
          Moved or changed bank?{" "}
          <Link href={STORE_APPLICATION} className="text-accent-text font-bold">
            Change your location or payout account
          </Link>
        </p>
      )}
    </div>
  );
}
