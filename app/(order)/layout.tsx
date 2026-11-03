import { AccountSwitch } from "@/components/partners/AccountSwitch";
import { OrderNav } from "@/components/order/OrderNav";
import { Toast } from "@/components/order/Toast";
import { APPLICATION, CONSOLE, getKitchen } from "@/lib/kitchen/data";
import { getPartner } from "@/lib/partners/data";
import { STORE_APPLICATION, STORE_CONSOLE, getStore } from "@/lib/store/data";
import { getCustomer } from "@/lib/shop/session";

/** The ordering web app: kitchens, menus, checkout, sign-in and tracking.
 *  Who is signed in is read here, on the server, so the header is right on
 *  the first paint and cannot be faked from the browser. */
export default async function OrderLayout({ children }: LayoutProps<"/">) {
  // The header's "who is signed in" must never take the whole page down: if
  // the backend can't be reached just now, show it as signed out. The page
  // itself still reports its own failure, with a way to try again.
  const [customer, kitchen, store, kitchenSession, storeSession] = await Promise.all([
    getCustomer().catch(() => null),
    getKitchen().catch(() => null),
    getStore().catch(() => null),
    getPartner("kitchen").catch(() => null),
    getPartner("store").catch(() => null),
  ]);
  // The kitchen and the store are separate sign-ins, so each shows only when
  // it is signed in. A session whose business has no such side yet still
  // links to where that side is registered.
  const business = [
    ...(kitchen
      ? [{ href: kitchen.status === "ACTIVE" ? CONSOLE : APPLICATION, label: "My kitchen" }]
      : kitchenSession
        ? [{ href: APPLICATION, label: "My kitchen" }]
        : []),
    ...(store
      ? [{ href: store.status === "ACTIVE" ? STORE_CONSOLE : STORE_APPLICATION, label: "My store" }]
      : storeSession
        ? [{ href: STORE_APPLICATION, label: "My store" }]
        : []),
  ];
  // The switch between the two consoles, drawn here so it survives the
  // change from one console to the other. A side that is not signed in reads
  // "+ Add …" and leads to registering it or signing in to it.
  const sides = [
    {
      side: "kitchen" as const,
      label: kitchenSession ? "Kitchen" : "+ Add kitchen",
      href: kitchenSession ? (kitchen?.status === "ACTIVE" ? CONSOLE : APPLICATION) : "/partners/kitchen",
    },
    {
      side: "store" as const,
      label: storeSession ? "Store" : "+ Add store",
      href: storeSession ? (store?.status === "ACTIVE" ? STORE_CONSOLE : STORE_APPLICATION) : "/partners/store",
    },
  ];
  return (
    <div className="bg-surface grow">
      <OrderNav
        user={customer ? { name: customer.name } : null}
        business={business.length > 0 ? business : null}
      />
      <main className="px-screen-x pt-lg pb-section-sm">
        <AccountSwitch sides={sides} />
        {children}
      </main>
      <Toast />
    </div>
  );
}
