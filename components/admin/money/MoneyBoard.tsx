"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatKobo, nairaToKobo } from "@/lib/money";
import type { MoneyView } from "@/lib/admin/data";
import { whenLabel } from "@/lib/admin/format";
import type { LiveOrder } from "@/lib/admin/orders";
import { say } from "@/lib/admin/store";
import { PAYMENT_LABEL, type AdminRole } from "@/lib/admin/types";
import { payOut } from "@/app/(admin)/admin/queue-actions";
import { refundOrder } from "@/app/(admin)/admin/order-actions";
import { findOrderByCode, sweepPushTokens } from "@/app/(admin)/admin/money-actions";

/**
 * Everything that moves money. The whole screen is readable by a moderator
 * and actionable only by a super admin — seeing what is owed is part of
 * running a shift; sending it is not. Every button is a server action that
 * re-checks the role, so nothing here is trusted from the client.
 *
 * The amounts come from the backend's own payouts-due calculation — the same
 * rows the transfer uses — so what this screen shows is what will be sent.
 */
export function MoneyBoard({ role, money }: { role: AdminRole; money: MoneyView }) {
  const canSend = role === "SUPER_ADMIN";
  const [busy, startTransition] = useTransition();

  const due = [
    ...money.kitchens
      .filter((k) => k.kitchenStatus === "ACTIVE" && k.netNaira > 0)
      .map((k) => ({
        id: k.kitchenId,
        kind: "kitchens" as const,
        name: k.name,
        meta: `Kitchen · ${k.orderCount} order${k.orderCount === 1 ? "" : "s"}`,
        netKobo: nairaToKobo(k.netNaira),
        blocked: k.hasPayoutAccount ? null : "No confirmed bank account yet.",
        confirm:
          "Settles every unpaid completed order after the 15% commission. One Paystack transfer, can't be undone.",
      })),
    ...money.riders
      // A rider who has collected more cash than they are owed is not due a
      // payout — they owe us the difference, and belong in "Cash to collect".
      .filter((r) => r.netNaira > 0)
      .map((r) => ({
        id: r.riderId,
        kind: "riders" as const,
        name: r.name ?? r.phone ?? "Customer",
        meta: `Rider · ${formatKobo(nairaToKobo(r.earnedNaira + r.waitPayNaira))} trip pay − ${formatKobo(
          nairaToKobo(r.cashHeldNaira),
        )} cash held`,
        netKobo: nairaToKobo(r.netNaira),
        blocked: r.hasPayoutAccount ? null : "No confirmed bank account yet.",
        confirm:
          "Trip pay and tips, minus cash they already collected. One Paystack transfer, can't be undone.",
      })),
  ].sort((a, b) => b.netKobo - a.netKobo);

  const total = due.reduce((sum, row) => sum + row.netKobo, 0);

  /** The other direction: cash-on-delivery money sitting in riders' pockets
   *  that is more than we owe them. Someone has to go and collect it. */
  const owing = money.riders
    .filter((r) => r.cashHeldNaira > r.earnedNaira + r.waitPayNaira)
    .map((r) => ({
      id: r.riderId,
      name: r.name ?? r.phone ?? "Customer",
      owesKobo: nairaToKobo(r.cashHeldNaira - r.earnedNaira - r.waitPayNaira),
    }));

  const [asking, setAsking] = useState<string | null>(null);


  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-3.5">
      <section className="bg-ops-surface min-w-0 overflow-hidden rounded-[15px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pt-xl pb-lg">
          <h2 className="text-text text-[16px]/[1.3] font-semibold whitespace-nowrap">
            Due for payout
          </h2>
          <span className="text-text/62 text-[12.5px]/[1.4] font-light">
            {due.length
              ? `${due.length} waiting · ${formatKobo(total)} in total`
              : ""}
          </span>
        </div>

        {!canSend && (
          <p className="bg-text/6 text-text/72 mx-[22px] mb-3.5 rounded-xl px-3.5 py-2.5 text-[12.5px]/[1.45] font-medium">
            Moderators can see what&rsquo;s due. Sending payouts needs a super
            admin.
          </p>
        )}

        {due.length === 0 ? (
          <p className="text-text/62 px-[22px] pt-9 pb-11 text-center text-[13px] font-light">
            Everyone is paid up.
          </p>
        ) : (
          due.map((row) => (
            <div
              key={row.id}
              className="border-text/6 flex flex-col gap-2.5 border-t px-[22px] py-3.5"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-text text-[14.5px] font-semibold">
                    {row.name}
                  </span>
                  <span className="text-text/62 text-[12.5px] font-light">
                    {row.meta}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-text text-[15px] font-bold whitespace-nowrap">
                    {formatKobo(row.netKobo)}
                  </span>
                  {canSend && !row.blocked && asking !== row.id && (
                    <button
                      type="button"
                      onClick={() => setAsking(row.id)}
                      className="bg-accent text-on-accent h-9 rounded-pill px-lg text-[12.5px] font-bold"
                    >
                      Send
                    </button>
                  )}
                </span>
              </div>

              {row.blocked && (
                <span className="text-warning text-[12.5px] font-medium">{row.blocked}</span>
              )}

              {asking === row.id && (
                <div
                  data-anim="drop"
                  className="bg-ops-surface-raised flex flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-3"
                >
                  <span className="text-text/75 min-w-[200px] flex-1 text-[12.5px]/[1.5]">
                    {row.confirm}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await payOut(row.kind, row.id);
                        say(result.ok ? `${result.message} to ${row.name}` : result.error);
                        if (result.ok) setAsking(null);
                      })
                    }
                    className="bg-text text-ops-surface h-9 rounded-pill px-lg text-[12.5px] font-bold disabled:opacity-40"
                  >
                    {busy ? "Sending…" : `Send ${formatKobo(row.netKobo)}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsking(null)}
                    className="border-text/16 text-text h-9 rounded-pill border px-lg text-[12.5px] font-semibold"
                  >
                    Back
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-3.5">
        {owing.length > 0 && (
          <section className="bg-ops-surface min-w-0 overflow-hidden rounded-[15px]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pt-xl pb-2">
              <h2 className="text-text text-[16px]/[1.3] font-semibold">
                Cash to collect
              </h2>
              <span className="text-text/62 text-[12.5px] font-light">
                Held from cash orders, beyond what they are owed
              </span>
            </div>
            {owing.map((rider) => (
              <div
                key={rider.id}
                className="border-text/6 flex items-center justify-between gap-3.5 border-t px-[22px] py-3.5"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-text text-[14px] font-semibold">
                    {rider.name}
                  </span>
                  <span className="text-text/62 text-[12.5px] font-light">
                    Rider
                  </span>
                </span>
                <span className="text-warning text-[15px] font-bold whitespace-nowrap">
                  {formatKobo(rider.owesKobo)}
                </span>
              </div>
            ))}
          </section>
        )}

        <RefundPanel role={role} />

        <section className="bg-ops-surface min-w-0 overflow-hidden rounded-[15px]">
          <h2 className="text-text px-[22px] pt-xl pb-2 text-[16px]/[1.3] font-semibold">
            Recent money movement
          </h2>
          {money.recent.length === 0 ? (
            <p className="text-text/62 px-[22px] pt-2 pb-xl text-[13px] font-light">
              Nothing has moved yet.
            </p>
          ) : (
            money.recent.map((tx) => (
              <div
                key={tx.id}
                className="border-text/6 flex items-center justify-between gap-3.5 border-t px-[22px] py-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-text truncate text-[13px] font-semibold">
                    {TX_LABEL[tx.type] ?? tx.type}
                    {tx.order ? ` · ${tx.order.code}` : ""}
                  </span>
                  <span className="text-text/55 truncate text-[11.5px] font-light">
                    {tx.partyKitchen?.name ?? tx.party?.name ?? tx.party?.phone ?? "—"} ·{" "}
                    {whenLabel(tx.createdAt)} · {tx.status.toLowerCase()}
                  </span>
                </span>
                <span className="text-text text-[13.5px] font-bold whitespace-nowrap">
                  {formatKobo(nairaToKobo(tx.amountNaira))}
                </span>
              </div>
            ))
          )}
        </section>

        <section className="bg-ops-surface flex flex-wrap items-center justify-between gap-3.5 rounded-[15px] px-[22px] py-xl">
          <div className="min-w-0 flex-1">
            <h2 className="text-text text-[15px] font-semibold">Clean up push tokens</h2>
            <p className="text-text/62 mt-1.5 text-[12.5px]/[1.5] font-light">
              Removes phones that no longer get notifications.
            </p>
          </div>
          {canSend && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  const result = await sweepPushTokens();
                  say(result.ok ? result.message : result.error);
                })
              }
              className="border-text/18 text-text h-10 rounded-pill border px-[18px] text-[13px] font-semibold whitespace-nowrap disabled:opacity-40"
            >
              {busy ? "Running…" : "Run now"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

const TX_LABEL: Record<string, string> = {
  ORDER_CHARGE: "Order payment",
  REFUND: "Refund",
  KITCHEN_PAYOUT: "Kitchen payout",
  RIDER_PAYOUT: "Rider payout",
  CASH_SETTLEMENT: "Cash settled",
  CREDIT_ISSUED: "Credit issued",
  CREDIT_REDEEMED: "Credit used",
};

/**
 * Refund by order number, because that is what the customer reads out. The
 * panel refuses in three different ways on purpose — not found, cash order,
 * wrong role — and each says what to do instead.
 */
function RefundPanel({ role }: { role: AdminRole }) {
  const [busy, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<LiveOrder | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);

  const total = order ? formatKobo(order.totalKobo) : "";
  const line = order
    ? `${total} back to ${order.customerName.split(" ")[0]} by ${PAYMENT_LABEL[order.payment].toLowerCase()}`
    : "";

  function look() {
    startTransition(async () => {
      const result = await findOrderByCode(query);
      setAsking(false);
      setNote("");
      setDone(false);
      if (!result.ok) {
        setOrder(null);
        setMissed(result.error);
      } else if (!result.order) {
        setOrder(null);
        setMissed(`No order ${query.trim().toUpperCase()}. Check the number and try again.`);
      } else {
        setOrder(result.order);
        setMissed(null);
      }
    });
  }

  return (
    <section
      data-theme="light"
      className="bg-ops-surface text-text flex flex-col gap-3.5 rounded-[15px] p-[22px]"
    >
      <div>
        <h2 className="text-[17px] font-bold tracking-[-0.02em]">Refund an order</h2>
        <p className="text-text/62 mt-1.5 text-[13px]/[1.5]">
          Enter the order number from the customer&rsquo;s receipt.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOrder(null);
            setMissed(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && look()}
          placeholder="KG-2196"
          aria-label="Order number"
          className="border-text/16 text-text placeholder:text-text/40 h-[46px] min-w-0 flex-1 rounded-pill border px-lg text-[14px] font-semibold uppercase outline-none"
        />
        <button
          type="button"
          onClick={look}
          disabled={busy}
          className="bg-text text-ops-surface h-[46px] rounded-pill px-lg text-[13.5px] font-bold disabled:opacity-40"
        >
          Find
        </button>
      </div>

      {missed && <span className="text-danger text-[13px] font-medium">{missed}</span>}

      {order && (
        <>
          <div
            data-anim="drop"
            className="bg-text/5 flex flex-col gap-1.5 rounded-[14px] p-3.5 text-[13px]/[1.45]"
          >
            <div className="flex items-baseline justify-between gap-2.5">
              <strong className="min-w-0">
                {order.code} · {order.customerName}
              </strong>
              <span className="font-extrabold">{total}</span>
            </div>
            <span className="text-text/62">
              {order.kitchens} · placed {order.placedLabel}
            </span>
            <span className="text-text/62">{PAYMENT_LABEL[order.payment]}</span>
          </div>

          {done || order.refunded ? (
            <span className="bg-accent/22 text-accent-text grid min-h-[46px] place-items-center rounded-pill px-lg text-center text-[13.5px] font-bold">
              ✓ Refunded{done ? ` · ${line}` : ""}
            </span>
          ) : order.payment === "cash" ? (
            <span className="text-text/62 text-[13px]/[1.5] font-medium">
              Cash on delivery: nothing was charged online, so there&rsquo;s nothing to refund here.
            </span>
          ) : order.paymentStatus !== "SUCCEEDED" ? (
            <span className="text-text/62 text-[13px]/[1.5] font-medium">
              This payment never went through, so there&rsquo;s nothing to refund.
            </span>
          ) : role !== "SUPER_ADMIN" ? (
            <span className="text-text/62 text-[13px]/[1.5] font-medium">
              Refunds need a super admin. Ask one to send it.
            </span>
          ) : (
            <>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Note for the audit log (optional)"
                className="border-text/16 text-text placeholder:text-text/40 resize-y rounded-xl border px-3 py-2.5 text-[13px]/[1.45] outline-none"
              />
              {asking ? (
                <div data-anim="drop" className="bg-danger-bg flex flex-col gap-2.5 rounded-[14px] px-3.5 py-3">
                  <span className="text-text/85 text-[13px]/[1.5]">
                    {line}. This can&rsquo;t be undone.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await refundOrder(order.id, note);
                          say(result.ok ? `${order.code} refunded · ${total}` : result.error);
                          if (result.ok) {
                            setDone(true);
                            setAsking(false);
                          }
                        })
                      }
                      className="bg-danger text-ops-surface h-9 rounded-pill px-lg text-[12.5px] font-bold disabled:opacity-40"
                    >
                      {busy ? "Refunding…" : `Refund ${total}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsking(false)}
                      className="border-text/16 text-text h-9 rounded-pill border px-lg text-[12.5px] font-semibold"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsking(true)}
                  className={cn("border-danger/30 text-danger h-[46px] rounded-pill border", "text-[13.5px] font-bold")}
                >
                  Refund {total}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
