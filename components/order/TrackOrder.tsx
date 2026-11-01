"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { formatKobo } from "@/lib/money";
import { say } from "@/lib/order/store";
import { cancelOrder, fetchOrder, payForOrder, verifyPayment, type TrackedOrder } from "@/app/(order)/actions";
import { cn } from "@/lib/cn";
import { useLiveUpdates } from "@/lib/live";

type Status = TrackedOrder["status"];

/** The five steps a customer cares about, and which backend statuses they
 *  cover. An order is "placed" until every kitchen accepts it. */
const stages = [
  { label: "Order placed", status: "Waiting for the kitchen to accept", covers: ["PLACED"] },
  { label: "Order accepted", status: "The kitchen has your order", covers: ["AWAITING_PAYMENT", "ACCEPTED"] },
  { label: "Cooking", status: "Your food is on the fire", covers: ["PREPARING", "READY"] },
  { label: "On the way", status: "Your rider is heading to you", covers: ["PICKED_UP", "DELIVERING"] },
  { label: "Delivered", status: "Enjoy your meal", covers: ["DELIVERED"] },
] satisfies { label: string; status: string; covers: Status[] }[];

/** The same journey for a grocery order: the store packs, nobody cooks. */
const groceryStages = [
  { ...stages[0], status: "Waiting for the store to accept" },
  { ...stages[1], status: "The store has your order" },
  { ...stages[2], label: "Packing", status: "Your groceries are being packed" },
  stages[3],
  { ...stages[4], status: "Enjoy" },
] satisfies { label: string; status: string; covers: Status[] }[];

const payLabel = { card: "Paid by card", transfer: "Paid by bank transfer", online: "Paid online" };

/** The customer was never charged in any of these (SYNC_WEB_CUSTOMER_AND_KITCHEN.md §2.1). */
const cancelReasonLabel = (place: string): Record<NonNullable<TrackedOrder["cancelReason"]>, string> => ({
  CUSTOMER: "You cancelled this order.",
  KITCHENS_DECLINED: `The ${place} couldn't take your order this time. You weren't charged.`,
  STORE_DECLINED: `The ${place} couldn't take your order this time. You weren't charged.`,
  PAYMENT_EXPIRED: "Payment wasn't completed in time, so the order was released. You weren't charged.",
  KITCHEN_TIMEOUT: `The ${place} didn't respond in time. You weren't charged.`,
});

/** How often to ask, in ms. Fast while things are moving, off when it ends. */
const POLL_MS = 8000;

/** How long to wait for Paystack's word after returning, before offering to pay again. */
const CONFIRM_WAIT_MS = 45_000;

function isOver(status: Status) {
  return status === "DELIVERED" || status === "CANCELLED" || status === "REFUNDED";
}

export function TrackOrder({
  initial,
  error,
  siteUrl,
}: {
  initial: TrackedOrder | null;
  error: string | null;
  siteUrl: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [problem, setProblem] = useState(error);
  const [busy, startTransition] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const id = order?.id;
  const over = order ? isOver(order.status) : true;
  // Paystack sends the customer back with a reference in the address. Its
  // word reaches the backend a moment later, so until then the payment still
  // reads as pending — confirming, not unpaid.
  const params = useSearchParams();
  const backFromPaystack = params.has("reference") || params.has("trxref");
  // The order can only be paid for while every kitchen has accepted and the
  // customer hasn't paid yet — that's exactly AWAITING_PAYMENT.
  const waitingForKitchen = !!order && order.status === "PLACED";
  const canPay = !!order && order.status === "AWAITING_PAYMENT";
  // Coming back from Paystack does not mean the payment happened: it also
  // returns after a cancelled or failed attempt. Give the confirmation a
  // little while, then show Pay again rather than waiting forever.
  const [gaveUp, setGaveUp] = useState(false);
  const awaitingPayment = canPay && backFromPaystack && !gaveUp;
  const mustPay = canPay && !awaitingPayment;

  useEffect(() => {
    if (!id || !backFromPaystack) return;
    // Never trust the Paystack redirect alone — ask the backend to confirm
    // with Paystack directly, which backs up a webhook that can run late.
    verifyPayment(id);
  }, [id, backFromPaystack]);

  useEffect(() => {
    if (!canPay || !backFromPaystack) return;
    const timer = setTimeout(() => setGaveUp(true), CONFIRM_WAIT_MS);
    return () => clearTimeout(timer);
  }, [canPay, backFromPaystack]);

  const live = !!id && (!over || awaitingPayment);
  async function reload() {
    if (!id) return;
    const result = await fetchOrder(id);
    if (result.ok) {
      setOrder(result.order);
      setProblem(null);
    }
    // A failed read is ignored: the last good answer stays on screen.
  }

  useLiveUpdates({
    scope: "customer",
    orderId: id,
    events: ["order:status", "rider:assigned"],
    onChange: reload,
    enabled: live,
  });

  useEffect(() => {
    if (!live) return;
    const poll = setInterval(reload, POLL_MS);
    return () => clearInterval(poll);
    // reload only reads `id`, which `live` already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, id]);

  if (!order) {
    return (
      <div className="bg-bg rounded-panel-sm mx-auto max-w-[640px] p-xxl text-center">
        <p className="text-site-title">We can&rsquo;t show that order</p>
        <p className="text-site-body text-text-secondary mt-sm">
          {problem ?? "Check the link, or log in with the number you ordered with."}
        </p>
        <ButtonLink href="/kitchens" variant="accent" size="site" className="mt-xl">
          Browse kitchens
        </ButtonLink>
      </div>
    );
  }

  const cancelled = order.status === "CANCELLED" || order.status === "REFUNDED";
  const grocery = order.side === "GROCERY";
  const steps = grocery ? groceryStages : stages;
  const place = grocery ? "store" : "kitchen";
  const browseHref = grocery ? "/stores" : "/kitchens";
  const stage = Math.max(0, steps.findIndex((s) => (s.covers as Status[]).includes(order.status)));
  const delivered = order.status === "DELIVERED";
  // Before the kitchen accepts, cancelling is immediate. After, it is a
  // request the kitchen has to confirm — until a rider has the food.
  const cancelNow = order.status === "PLACED" || order.status === "AWAITING_PAYMENT";
  const cancelByAsking = order.status === "ACCEPTED" || order.status === "PREPARING" || order.status === "READY";
  const canCancel = cancelNow || (cancelByAsking && !order.cancelRequested);

  return (
    <div className="gap-xl mx-auto flex max-w-[1240px] flex-wrap items-start">
      <Screen
        mode="dark"
        className="rounded-panel-lg p-xxl md:p-pad-card relative min-w-0 flex-[2_1_480px] overflow-hidden"
      >
        <div
          aria-hidden
          className="border-accent/18 pointer-events-none absolute top-[-160px] right-[-120px] size-[440px] rounded-full border-[1.5px]"
        />
        <div className="relative">
          <p className="text-label text-cream/50 font-bold tracking-[0.06em] uppercase">
            Order {order.code} · {order.kitchen}
          </p>
          <h1 className="text-panel-small md:text-panel text-cream mt-sm">
            {cancelled
              ? order.status === "REFUNDED"
                ? "Cancelled and refunded"
                : "This order was cancelled"
              : delivered
                ? "Delivered. Enjoy!"
                : awaitingPayment
                  ? "Confirming your payment…"
                  : mustPay
                    ? `${order.kitchen} accepted. Pay to start ${grocery ? "packing" : "cooking"}`
                    : steps[stage].label}
          </h1>
          <p className="text-panel-body text-cream/65 mt-md">
            {cancelled
              ? order.cancelReason
                ? cancelReasonLabel(place)[order.cancelReason]
                : order.payment === "paid" || order.payment === "refunded"
                  ? "If you paid online, the money goes back to you."
                  : "You weren't charged."
              : awaitingPayment
                ? "Paystack is telling us your payment went through. This page updates by itself."
                : mustPay
                  ? <>
                      Pay {formatKobo(order.amountDueKobo)} now and {order.kitchen} gets {grocery ? "packing" : "cooking"} · to {order.to}
                      {order.paymentDueAt && (
                        <> · <Countdown to={order.paymentDueAt} /></>
                      )}
                    </>
                  : waitingForKitchen
                    ? `Waiting for ${order.kitchen} to accept. You pay only once they do · to ${order.to}`
                    : `${steps[stage].status} · to ${order.to}`}
          </p>

          {!cancelled && (
            <>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={stage}
                aria-label="Delivery progress"
                className="bg-text/10 rounded-pill mt-xxl h-[8px] overflow-hidden"
              >
                <div
                  className="bg-accent rounded-pill h-full transition-[width] duration-(--duration-slow)"
                  style={{ width: `${Math.max(6, stage * 25)}%` }}
                />
              </div>

              <ol className="mt-xxl gap-lg flex flex-col">
                {steps.map((s, i) => (
                  <li
                    key={s.label}
                    className={cn(
                      "text-site-body gap-md flex items-center font-semibold transition-colors duration-(--duration-slow)",
                      i <= stage ? "text-cream" : "text-cream/40",
                    )}
                  >
                    <span
                      className={cn(
                        "size-[12px] shrink-0 rounded-full",
                        i < stage && "bg-accent",
                        i === stage && "bg-accent-warm",
                        i === stage && !delivered && "route-pulse",
                        i > stage && "bg-text/18",
                      )}
                    />
                    {s.label}
                  </li>
                ))}
              </ol>
            </>
          )}

          {order.rider && !over && (
            <div className="bg-text/7 rounded-step mt-xxl gap-md rise flex flex-wrap items-center py-md pr-md pl-lg">
              <span className="bg-accent text-on-accent text-h3 grid size-[46px] shrink-0 place-items-center rounded-full font-extrabold">
                {order.rider.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-[120px] flex-1">
                <div className="text-site-question text-cream">{order.rider.name}</div>
                <div className="text-label text-cream/55 mt-[3px]">Your rider</div>
              </div>
              {order.rider.phone && (
                <a
                  href={`tel:${order.rider.phone}`}
                  className="bg-accent text-on-accent rounded-pill text-nav-link px-xl py-md font-bold active:scale-95"
                >
                  Call
                </a>
              )}
            </div>
          )}

          {problem && <p className="text-site-label text-cream/70 mt-lg">{problem}</p>}

          {cancelByAsking && order.cancelRequested && (
            <p className="bg-text/10 text-cream rounded-field text-site-label mt-lg px-lg py-md font-semibold">
              You asked to cancel this order. Karrigo is checking with {order.kitchen} — it stays open until they
              confirm, and this page updates when they do.
            </p>
          )}
          {cancelByAsking && confirmingCancel && (
            <p className="text-site-label text-cream/70 mt-lg">
              {order.kitchen} has already accepted, so we&rsquo;ll ask them to cancel. It isn&rsquo;t cancelled until
              they confirm{order.payment === "paid" ? ", and your money is refunded once they do" : ""}.
            </p>
          )}

          <div className="mt-xl gap-sm flex flex-wrap">
            {order.trackingToken && (
              <button
                type="button"
                className="bg-accent text-on-accent rounded-pill text-nav-link px-xl py-md font-bold"
                onClick={async () => {
                  const link = `${siteUrl}/track/${order.trackingToken}`;
                  try {
                    await navigator.clipboard.writeText(link);
                    say("Tracking link copied — anyone with it can follow this delivery");
                  } catch {
                    say(link);
                  }
                }}
              >
                Share tracking link
              </button>
            )}
            {canPay ? (
              <Button
                type="button"
                variant="accent"
                size="site"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    const result = await payForOrder(order.id);
                    if (result.ok) window.location.href = result.payUrl;
                    else say(result.error);
                  })
                }
              >
                {order.payment === "failed" ? "Try paying again" : "Pay now"}
              </Button>
            ) : null}

            {over ? (
              <Button type="button" variant="accent" size="site" onClick={() => router.push(browseHref)}>
                Order something else
              </Button>
            ) : (
              <button
                type="button"
                className="bg-accent/14 text-accent-text rounded-pill text-nav-link px-xl py-md font-bold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    say("Link copied — it opens for the account that placed the order");
                  } catch {
                    say("Copy the address bar to open this order again");
                  }
                }}
              >
                Copy order link
              </button>
            )}

            {canCancel &&
              (confirmingCancel ? (
                <>
                  <Button
                    type="button"
                    variant="muted"
                    size="site"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await cancelOrder(order.id);
                        if (!result.ok) {
                          setConfirmingCancel(false);
                          return say(result.error);
                        }
                        const next = await fetchOrder(order.id);
                        if (next.ok) setOrder(next.order);
                        setConfirmingCancel(false);
                        say(result.requested ? `We've asked ${order.kitchen} to cancel` : "Order cancelled");
                      })
                    }
                  >
                    {busy ? "Cancelling…" : cancelNow ? "Yes, cancel it" : "Yes, ask to cancel"}
                  </Button>
                  <button type="button" onClick={() => setConfirmingCancel(false)} className="text-cream/70 text-nav-link px-lg font-bold">
                    Keep my order
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="text-cream/70 rounded-pill text-nav-link px-lg py-md font-bold"
                >
                  Cancel order
                </button>
              ))}
          </div>
        </div>
      </Screen>

      <aside className="bg-bg rounded-panel-sm p-xl min-w-0 flex-[1_1_300px]">
        <h2 className="text-h1 font-extrabold">Receipt</h2>
        <div className="gap-sm mt-md flex flex-col">
          {order.items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="gap-sm text-site-label flex font-semibold">
              <span className="text-accent-text shrink-0">{item.qty}×</span>
              <span className="min-w-0 flex-1">{item.name}</span>
              <span className="shrink-0">{formatKobo(item.lineKobo)}</span>
            </div>
          ))}
        </div>
        <dl className="border-surface-raised text-site-label text-text-secondary mt-lg gap-sm flex flex-col border-t pt-md font-semibold">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatKobo(order.subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd>{order.feeKobo ? formatKobo(order.feeKobo) : "Free"}</dd>
          </div>
          {order.discountKobo > 0 && (
            <div className="text-accent-text flex justify-between">
              <dt>Promo</dt>
              <dd>−{formatKobo(order.discountKobo)}</dd>
            </div>
          )}
          {order.creditKobo > 0 && (
            <div className="text-accent-text flex justify-between">
              <dt>Karrigo credit</dt>
              <dd>−{formatKobo(order.creditKobo)}</dd>
            </div>
          )}
          <div className="text-h1 text-text mt-xs flex justify-between font-extrabold">
            <dt>Total</dt>
            <dd>{formatKobo(order.totalKobo)}</dd>
          </div>
          <div className="text-label mt-xs">
            {order.payment === "paid"
              ? payLabel[order.pay]
              : waitingForKitchen
                ? `You pay once ${order.kitchen} accepts`
                : order.payment === "pending"
                  ? awaitingPayment
                    ? "Payment not confirmed yet"
                    : "Not paid yet"
                  : order.payment === "failed"
                    ? "Payment didn't go through"
                    : "Refunded"}
          </div>
        </dl>
        <ButtonLink href={browseHref} variant="muted" size="site" full className="mt-lg">
          {grocery ? "Back to stores" : "Back to kitchens"}
        </ButtonLink>
      </aside>
    </div>
  );
}

/** Ticks down to a server-given deadline — never a client-side timer of its
 *  own (§3: "Drive countdowns from paymentDueAt, not a client timer"). */
function Countdown({ to }: { to: string }) {
  const deadline = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  if (left <= 0) return <>time&rsquo;s up</>;
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  return <>{mins}:{secs.toString().padStart(2, "0")} left to pay</>;
}
