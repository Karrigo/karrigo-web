import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { api, type Schemas } from "@/lib/api/client";
import { formatKobo, nairaToKobo } from "@/lib/money";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = { title: "My orders · Karrigo", robots: { index: false } };

const LABEL: Record<Schemas["OrderWithDetailsResponseDto"]["status"], string> = {
  PLACED: "Waiting for the kitchen",
  AWAITING_PAYMENT: "Waiting for payment",
  ACCEPTED: "Accepted",
  PREPARING: "Cooking",
  READY: "Ready for pickup",
  PICKED_UP: "On the way",
  DELIVERING: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function OrdersPage() {
  if (!(await getCustomer())) redirect("/login?next=/orders");
  const [mine, incoming] = await Promise.all([
    api<Schemas["OrderWithDetailsResponseDto"][]>("/orders", { scope: "customer" }),
    // Orders other people sent to this customer. Never let a failure here hide their own.
    api<Schemas["OrderWithDetailsResponseDto"][]>("/orders/incoming", { scope: "customer" }).catch(() => []),
  ]);
  const orders = [...mine, ...incoming].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const giftNote = (o: Schemas["OrderWithDetailsResponseDto"]): string | null => {
    const g = o as unknown as { isGift?: boolean; senderDisplayName?: string | null; recipientDisplayName?: string | null };
    if (!g.isGift) return null;
    return g.senderDisplayName !== undefined
      ? `From ${g.senderDisplayName ?? "a friend"}`
      : `Sent to ${g.recipientDisplayName ?? "a friend"}`;
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="text-section-small md:text-section mt-sm mb-md">My orders</h1>
      <p className="text-site-label mb-xl">
        <Link href="/account" className="text-accent-text font-bold">
          Your tag &amp; who can send you orders
        </Link>
      </p>

      {orders.length === 0 ? (
        <div className="bg-bg rounded-panel-sm px-xl py-[48px] text-center">
          <p className="text-site-title">No orders yet</p>
          <p className="text-site-body text-text-secondary mt-sm mb-xl">Your first one is a few taps away.</p>
          <ButtonLink href="/kitchens" variant="accent" size="site">
            Browse kitchens
          </ButtonLink>
        </div>
      ) : (
        <ul className="gap-md flex flex-col">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/track?order=${o.id}`}
                className="bg-bg rounded-panel-sm p-lg gap-md flex items-center justify-between transition-colors hover:bg-surface-raised"
              >
                <span className="min-w-0">
                  <span className="text-site-question block truncate">
                    {[...o.kitchenOrders.map((k) => k.kitchen.name), ...o.storeOrders.map((s) => s.store.name)].join(" + ")}
                  </span>
                  <span className="text-site-label text-text-secondary mt-xs block">
                    {giftNote(o) ? `${giftNote(o)} · ` : ""}{o.code} · {when.format(new Date(o.placedAt))} · {LABEL[o.status]}
                  </span>
                </span>
                <span className="text-site-body shrink-0 font-bold">{formatKobo(nairaToKobo(o.totalNaira))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
