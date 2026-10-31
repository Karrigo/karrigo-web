"use client";

import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import { isActive, type LiveOrder, type OrderDetailView } from "@/lib/admin/orders";
import { say } from "@/lib/admin/store";
import { CANCEL_REASON_LABEL, PAYMENT_LABEL, type AdminRole } from "@/lib/admin/types";
import { Eyebrow } from "@/components/admin/ui";
import { RiderOperations } from "./RiderOperations";
import { useLiveElapsed } from "./useLiveElapsed";
import {
  giveCredit,
  loadOrderDetail,
  refundOrder,
} from "@/app/(admin)/admin/order-actions";

/** What a late-order apology is worth, until policy says otherwise. The
 *  amount stays editable — the backend takes any figure. */
const DEFAULT_CREDIT_NAIRA = 500;

/**
 * One order, in full, with the two things ops can do about it: apologise with
 * credit, or refund. Riders are not assigned by hand — they accept broadcast
 * offers — so there is no "assign" here.
 *
 * The panel is light in both themes — `data-theme="light"` rather than
 * hardcoded hex, so every token inside resolves to its light value. It is a
 * document: a receipt and a timeline someone reads closely, often while on
 * the phone to a customer, and it stays legible when the room is bright.
 */
export function OrderDetail({ order, role }: { order: LiveOrder; role: AdminRole }) {
  const [detail, setDetail] = useState<OrderDetailView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<"credit" | "refund" | null>(null);
  const [creditNaira, setCreditNaira] = useState(String(DEFAULT_CREDIT_NAIRA));
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();
  const { label } = useLiveElapsed(order);

  useEffect(() => {
    let cancelled = false;
    loadOrderDetail(order.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setDetail(result.detail);
      else setProblem(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const currentOrder = detail ? { ...order, ...detail.riderOperations } : order;

  const canRefund =
    role === "SUPER_ADMIN" && !order.refunded && order.paymentStatus === "SUCCEEDED";
  const canCredit = !order.cancelled;
  const creditKobo = Math.round(Number(creditNaira) * 100);

  function run(action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      say(result.ok ? result.message : result.error);
      if (result.ok) {
        setMode(null);
        setNote("");
      }
    });
  }

  return (
    <div data-theme="light" className="bg-ops-surface text-text overflow-hidden rounded-[15px]">
      <header className="border-text/8 border-b px-[22px] pt-[22px] pb-lg">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-[22px]/none font-extrabold tracking-[-0.03em]">{order.code}</span>
          <span className="text-text/62 text-[12.5px] font-medium">
            Placed {order.placedLabel} · {label}{isActive(order) ? " ago" : " since"}
          </span>
        </div>
        <p className="text-text/80 mt-2 text-[13.5px]/[1.5]">
          {detail ? (
            <>
              {detail.address}
              {detail.instructions && <span className="text-text/62"> · {detail.instructions}</span>}
            </>
          ) : problem ? (
            <span className="text-danger">{problem}</span>
          ) : (
            <span className="text-text/45">Loading the address…</span>
          )}
        </p>
        {order.status === "AWAITING_PAYMENT" && (
          <p className="text-warning mt-1.5 text-[12.5px] font-semibold">
            Waiting for the customer to pay{order.paymentDueAt && <> · due {new Date(order.paymentDueAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        )}
        {order.cancelled && order.cancelReason && (
          <p className="text-text/62 mt-1.5 text-[12.5px] font-semibold">{CANCEL_REASON_LABEL[order.cancelReason]} · not charged</p>
        )}
      </header>

      <div className="bg-text/8 border-text/8 grid grid-cols-3 gap-px border-b">
        <Fact label="Customer" value={order.customerName} sub={order.customerPhone} />
        <Fact label="Kitchen" value={order.kitchens} />
        <Fact label="Rider" value={currentOrder.riderName ?? "Unassigned"} />
      </div>

      <section aria-label="Rider operations" className="border-text/8 border-b px-lg py-lg">
        <h3 className="mb-2 text-sm font-bold">Rider operations</h3>
        <RiderOperations order={currentOrder} summary />
      </section>

      {detail && (
        <>
          <section aria-label="Rider assignment history" className="border-text/8 border-b px-lg py-lg">
            <h3 className="mb-3 text-sm font-bold">Rider assignment history</h3>
            {detail.riderAssignments.length === 0 ? (
              <p className="text-text/62 text-xs">{currentOrder.riderId ? "This legacy rider has no recorded assignment history. Acceptance time is unknown." : "No rider has a recorded assignment yet."}</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {detail.riderAssignments.map((assignment) => (
                  <li key={assignment.id} className="border-text/16 border-l-2 pl-3 text-xs">
                    <p className="text-sm font-semibold">{assignment.riderName}</p>
                    <p className="text-text/62">{ASSIGNMENT_STATUS_LABEL[assignment.status]}</p>
                    <p className="mt-1">Accepted: {assignment.acceptedAt ? assignmentTime(assignment.acceptedAt) : "Time unknown"}</p>
                    {assignment.endedAt && <p>Ended: {assignmentTime(assignment.endedAt)}</p>}
                    {assignment.reason && <p className="mt-1 font-medium">{assignment.reason}</p>}
                    {assignment.note && <p className="text-text/62 mt-1 whitespace-pre-wrap break-words">{assignment.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <ol className="border-text/8 flex flex-col border-b px-[22px] py-lg">
            {detail.timeline.map((step) => (
              <li
                key={step.label}
                className="grid h-[30px] grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    "border-text size-3 rounded-full border-2",
                    step.reached ? (step.current ? "bg-accent" : "bg-text") : "bg-ops-surface opacity-30",
                  )}
                />
                <span
                  className={cn(
                    "text-[13px]",
                    step.reached
                      ? step.current
                        ? "text-text font-bold"
                        : "text-text font-medium"
                      : "text-text/45 font-medium",
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn("text-[12.5px] font-semibold", step.reached ? "text-text" : "text-text/45")}
                >
                  {step.time}
                </span>
              </li>
            ))}
          </ol>

          <div className="border-text/8 flex flex-col gap-[7px] border-b px-[22px] py-3.5 text-[13px]">
            {detail.items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex justify-between gap-2.5">
                <span>
                  <span className="text-text/62">{item.qty}×</span> {item.name}
                </span>
                <span>{formatKobo(item.qty * item.unitPriceKobo)}</span>
              </div>
            ))}
            <Line label="Delivery" kobo={detail.feeKobo} />
            {detail.tipKobo > 0 && <Line label="Tip" kobo={detail.tipKobo} />}
            {detail.discountKobo > 0 && (
              <Line label={`Promo${detail.promoCode ? ` ${detail.promoCode}` : ""}`} kobo={-detail.discountKobo} accent />
            )}
            {detail.creditKobo > 0 && <Line label="Store credit used" kobo={-detail.creditKobo} accent />}
            <div className="border-text/16 mt-1 flex items-baseline justify-between border-t border-dashed pt-2.5">
              <span className="font-semibold">{PAYMENT_LABEL[order.payment]}</span>
              <span className="text-[18px] font-extrabold">{formatKobo(detail.totalKobo)}</span>
            </div>
          </div>

          {detail.log.length > 0 && (
            <ul className="border-text/8 text-text/62 flex flex-col gap-1.5 border-b px-[22px] py-3.5 text-[12px]">
              {detail.log.map((entry, i) => (
                <li key={i}>
                  {entry.event} · {entry.by} · {entry.at}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {(canCredit || canRefund) && (
        <div className="flex flex-col gap-2.5 px-[22px] pt-lg pb-xl">
          {mode === null && (
            <div className="flex flex-wrap gap-2">
              {canCredit && (
                <button
                  type="button"
                  onClick={() => setMode("credit")}
                  className="bg-accent text-on-accent h-10 rounded-pill px-[18px] text-[13px] font-bold"
                >
                  Give credit
                </button>
              )}
              {canRefund && (
                <button
                  type="button"
                  onClick={() => setMode("refund")}
                  className="border-danger/30 text-danger h-10 rounded-pill border px-[18px] text-[13px] font-bold"
                >
                  Refund order
                </button>
              )}
            </div>
          )}

          {mode === "credit" && (
            <div className="bg-accent/14 flex flex-col gap-2.5 rounded-[15px] p-3.5">
              <span className="text-[13.5px] font-semibold">Give {order.customerName} store credit?</span>
              <span className="text-text/80 text-[12.5px]/[1.5]">
                It is applied in full at their next checkout.
              </span>
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                ₦
                <input
                  value={creditNaira}
                  onChange={(event) => setCreditNaira(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  aria-label="Credit in naira"
                  className="border-text/16 bg-ops-surface h-9 w-[110px] rounded-xl border px-3 text-[13px] outline-none"
                />
              </label>
              <Buttons
                busy={busy}
                disabled={!(creditKobo > 0)}
                label={`Send ${creditKobo > 0 ? formatKobo(creditKobo) : "credit"}`}
                tone="go"
                onConfirm={() => run(() => giveCredit(order.customerId, creditKobo, `Order ${order.code}`))}
                onBack={() => setMode(null)}
              />
            </div>
          )}

          {mode === "refund" && (
            <div className="bg-danger-bg flex flex-col gap-2.5 rounded-[15px] p-3.5">
              <span className="text-[13.5px] font-semibold">Refund {order.code}?</span>
              <span className="text-text/80 text-[12.5px]/[1.5]">
                {formatKobo(order.totalKobo)} goes back to the customer through Paystack. This can&apos;t
                be undone.
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Reason (optional) · saved to the audit log"
                className="border-text/16 bg-ops-surface text-text placeholder:text-text/45 rounded-xl border px-3 py-2 text-[12.5px] outline-none"
              />
              <Buttons
                busy={busy}
                label="Refund"
                tone="bad"
                onConfirm={() => run(() => refundOrder(order.id, note))}
                onBack={() => setMode(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ASSIGNMENT_STATUS_LABEL = {
  ACTIVE: "Current assignment",
  ABANDONED: "Abandoned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const assignmentClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short",
});

function assignmentTime(at: string) {
  return assignmentClock.format(new Date(at));
}

function Buttons({
  busy,
  disabled,
  label,
  tone,
  onConfirm,
  onBack,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  tone: "go" | "bad";
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={busy || disabled}
        onClick={onConfirm}
        className={cn(
          "h-9 rounded-pill px-lg text-[12.5px] font-bold disabled:opacity-40",
          tone === "bad" ? "bg-danger text-ops-surface" : "bg-accent text-on-accent",
        )}
      >
        {busy ? "Working…" : label}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="border-text/16 text-text h-9 rounded-pill border px-lg text-[12.5px] font-semibold"
      >
        Back
      </button>
    </div>
  );
}

function Line({ label, kobo, accent }: { label: string; kobo: number; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between", accent ? "text-accent-text font-semibold" : "text-text/62")}>
      <span>{label}</span>
      <span>{kobo < 0 ? `−${formatKobo(-kobo)}` : formatKobo(kobo)}</span>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ops-surface flex min-w-0 flex-col gap-[3px] px-3.5 py-3">
      <Eyebrow className="text-[10.5px]">{label}</Eyebrow>
      <span className="truncate text-[13px] font-semibold">{value}</span>
      {sub && <span className="text-text/62 text-[11.5px]">{sub}</span>}
    </div>
  );
}
