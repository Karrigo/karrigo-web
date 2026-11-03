"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setOrderStatus } from "@/app/(order)/my-kitchen/actions";
import { useLiveUpdates } from "@/lib/live";
import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import type { KitchenOrder, OrderStatus } from "@/lib/kitchen/types";
import { Empty } from "./parts";

const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });

/** What the kitchen does next with an order in each state. PICKED_UP is the
 *  kitchen's to press, but the backend only allows it once a rider has
 *  taken the order. */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; working: string }>> = {
  PLACED: { to: "ACCEPTED", label: "Accept order", working: "Accepting…" },
  ACCEPTED: { to: "PREPARING", label: "Start cooking", working: "Starting…" },
  PREPARING: { to: "READY", label: "Ready for pickup", working: "Marking ready…" },
  READY: { to: "PICKED_UP", label: "Handed to rider", working: "Handing over…" },
};

/** The same steps for a grocery store, which packs rather than cooks. */
const NEXT_GROCERY: typeof NEXT = {
  ...NEXT,
  ACCEPTED: { to: "PREPARING", label: "Start packing", working: "Starting…" },
};

const GROUPS: { title: string; statuses: OrderStatus[]; hint: string }[] = [
  { title: "New", statuses: ["PLACED"], hint: "Accept these first — the customer is waiting to hear from you." },
  { title: "Being prepared", statuses: ["ACCEPTED", "PREPARING"], hint: "" },
  { title: "Waiting for the rider", statuses: ["READY"], hint: "" },
];

const DONE_LABEL: Partial<Record<OrderStatus, string>> = { PICKED_UP: "Handed to rider", CANCELLED: "Cancelled" };

/** An order can arrive, get paid or be cancelled while the page sits open.
 *  The socket says so at once; the slow poll covers a dropped socket. */
function useFreshOrders(scope: "kitchen" | "store") {
  const router = useRouter();
  useLiveUpdates({
    scope,
    events: ["order:new", "order:paid", "order:cancelled"],
    onChange: () => router.refresh(),
  });
  // The backstop for a dropped socket. Slower than it was, and silent while
  // the tab is hidden: the socket and the focus refresh above catch up the
  // moment someone looks, and every refresh is several calls to the backend.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);
}

export function OrdersBoard({
  orders,
  isOpen,
  onStatus = setOrderStatus,
  place = "kitchen",
}: {
  orders: KitchenOrder[];
  isOpen: boolean;
  /** Moves an order along. A store has its own endpoint. */
  onStatus?: typeof setOrderStatus;
  place?: "kitchen" | "store";
}) {
  useFreshOrders(place);
  const active = orders.filter((o) => o.status !== "PICKED_UP" && o.status !== "CANCELLED");
  // Newest first, and only the recent ones: this is a shift's record, not a ledger.
  const done = orders
    .filter((o) => o.status === "PICKED_UP" || o.status === "CANCELLED")
    .reverse()
    .slice(0, 20);

  return (
    <div className="gap-xl flex flex-col">
      {active.length === 0 && (
        <Empty
          title="No orders waiting"
          text={
            isOpen
              ? "New orders show up here on their own. Keep this page open and turn on the order sound so you hear them."
              : `You're closed, so nobody can order. Open your ${place} from the Today tab when you're ready.`
          }
        />
      )}

      {GROUPS.map((group) => {
        const list = active.filter((o) => group.statuses.includes(o.status));
        if (list.length === 0) return null;
        return (
          <section key={group.title}>
            <h2 className="text-site-title">
              {group.title} · {list.length}
            </h2>
            {group.hint && <p className="text-site-label text-text-secondary mt-xs">{group.hint}</p>}
            <ul className="gap-md mt-md grid md:grid-cols-2">
              {list.map((o) => (
                <li key={o.id}>
                  <OrderCard order={o} onStatus={onStatus} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section>
          <h2 className="text-site-title">Finished</h2>
          <ul className="bg-bg rounded-panel-sm mt-md px-xl">
            {done.map((o) => (
              <li key={o.id} className="border-surface-raised gap-md flex items-center justify-between border-b py-md last:border-b-0">
                <span className="min-w-0">
                  <span className="text-site-question block truncate">
                    {o.code} · {o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}
                  </span>
                  <span className={cn("text-site-label mt-xs block", o.status === "CANCELLED" ? "text-danger-text" : "text-text-secondary")}>
                    {DONE_LABEL[o.status]} · {day.format(new Date(o.placedAt))}, {time.format(new Date(o.placedAt))}
                  </span>
                </span>
                <span className="text-site-body shrink-0 font-bold">{formatKobo(o.subtotalKobo)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OrderCard({ order, onStatus }: { order: KitchenOrder; onStatus: typeof setOrderStatus }) {
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState<OrderStatus | null>(null);
  const [busy, startTransition] = useTransition();
  const grocery = order.type === "GROCERY";
  const next = (grocery ? NEXT_GROCERY : NEXT)[order.status];
  const isNew = order.status === "PLACED";
  // A store can accept a grocery order without the lines it can't supply.
  // Ticked here, sent with the accept, and never charged.
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const choosing = grocery && isNew;
  const supplied = order.items.filter((i) => !i.unavailable && !(choosing && unavailable.includes(i.id)));
  const declineAll = choosing && supplied.length === 0;
  const total = supplied.reduce((sum, i) => sum + i.unitPriceKobo * i.qty, 0);
  // The kitchen's own row is ACCEPTED whether or not the customer has paid —
  // the parent order is what tells the two apart (SYNC_WEB_CUSTOMER_AND_KITCHEN.md §1).
  const awaitingPayment = order.status === "ACCEPTED" && !order.order.paidAt;

  function move(to: OrderStatus) {
    setError("");
    setMoving(to);
    startTransition(async () => {
      const result = await onStatus(order.id, to, to === "ACCEPTED" ? unavailable : []);
      if (!result.ok) setError(result.error);
      setConfirming(false);
      setMoving(null);
    });
  }

  return (
    <article className={cn("bg-bg rounded-panel-sm p-xl gap-md flex h-full flex-col", isNew && "ring-accent-text ring-2")}>
      <header className="gap-md flex items-baseline justify-between">
        <h3 className="text-h1 font-extrabold">{order.code}</h3>
        <span className="text-site-label text-text-secondary shrink-0">
          {time.format(new Date(order.placedAt))}
          {order.area && ` · going to ${order.area}`}
        </span>
      </header>

      <ul className="grow">
        {order.items.map((i) => {
          const out = i.unavailable || (choosing && unavailable.includes(i.id));
          return (
            <li key={i.id} className="py-xs">
              <div className="text-site-body gap-md flex justify-between">
                <span className={cn("min-w-0", out && "text-text-secondary line-through")}>
                  <span className="font-extrabold">{i.qty} ×</span> {i.name}
                </span>
                <span className={cn("text-text-secondary shrink-0", out && "line-through")}>
                  {formatKobo(i.unitPriceKobo * i.qty)}
                </span>
              </div>
              {i.unavailable && !choosing && (
                <p className="text-site-chip text-text-secondary">Not supplied — not charged</p>
              )}
              {choosing && (
                <label className="text-site-label gap-sm mt-xs flex items-center font-semibold">
                  <input
                    type="checkbox"
                    checked={unavailable.includes(i.id)}
                    onChange={(e) =>
                      setUnavailable((ids) => (e.target.checked ? [...ids, i.id] : ids.filter((x) => x !== i.id)))
                    }
                  />
                  Can&rsquo;t supply
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <p className="border-surface-raised text-site-body flex justify-between border-t pt-md font-bold">
        <span>{grocery ? "Total" : "Food total"}</span>
        <span>{formatKobo(choosing ? total : order.subtotalKobo)}</span>
      </p>

      {awaitingPayment && (
        <p className="bg-warning-bg text-warning text-site-label rounded-field px-lg py-md font-semibold">
          Awaiting payment{order.order.paymentDueAt && <> · <Countdown to={order.order.paymentDueAt} /></>}
        </p>
      )}

      {error && (
        <p role="alert" className="text-danger-text text-site-label shake font-semibold">
          {error}
        </p>
      )}

      {confirming ? (
        <div className="bg-danger-bg rounded-field p-lg">
          <p className="text-danger-text text-site-label font-bold">
            Cancel {order.code}? The customer won&rsquo;t get {grocery ? "these items" : "this food"}, and it can&rsquo;t be undone.
          </p>
          <div className="gap-sm mt-md flex flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() => move("CANCELLED")}
              className="bg-danger text-bg rounded-pill text-site-button px-xl py-md disabled:opacity-50"
            >
              {moving === "CANCELLED" ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="bg-bg text-text rounded-pill text-site-button px-xl py-md disabled:opacity-50"
            >
              Keep the order
            </button>
          </div>
        </div>
      ) : (
        <div className="gap-sm flex flex-wrap items-center">
          {next && (
            <button
              type="button"
              disabled={busy || awaitingPayment}
              title={awaitingPayment ? "Waiting for the customer to pay" : undefined}
              onClick={() => (declineAll ? setConfirming(true) : move(next.to))}
              className={cn(
                "rounded-pill text-site-button grow px-xl py-md transition-transform duration-(--duration-fast) active:scale-95 disabled:opacity-50",
                isNew ? "bg-accent text-on-accent" : "bg-text text-bg",
              )}
            >
              {awaitingPayment
                ? "Waiting for payment"
                : declineAll
                  ? "Decline order"
                  : moving === next.to
                    ? next.working
                    : next.label}
            </button>
          )}
          {order.status !== "READY" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-text-secondary hover:text-danger-text rounded-pill text-site-label px-lg py-md font-semibold disabled:opacity-50"
            >
              {isNew ? (grocery ? "Can't supply it" : "Can't take it") : "Cancel order"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Ticks down to a server-given deadline. Never a client-side 10-minute
 *  timer of its own — `paymentDueAt` is the only truth. */
function Countdown({ to }: { to: string }) {
  const deadline = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  if (left <= 0) return <>payment window closed</>;
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  return <>{mins}:{secs.toString().padStart(2, "0")} left to pay</>;
}
