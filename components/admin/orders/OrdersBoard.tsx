"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import {
  RIDER_STATES,
  RIDER_STATE_LABEL,
  matchesRiderState,
  type RiderState,
  ORDER_FILTERS,
  ORDER_FILTER_LABEL,
  isUnassigned,
  matchesFilter,
  matchesQuery,
  type LiveOrder,
  type OrderFilter,
} from "@/lib/admin/orders";
import { PAYMENT_LABEL, STAGE_LABEL } from "@/lib/admin/types";
import type { AdminRole } from "@/lib/admin/types";
import { CountTab, EmptyState, StatusChip, type Tone } from "@/components/admin/ui";

import { RiderOperations } from "./RiderOperations";
import { OrderDetail } from "./OrderDetail";
import { useLiveElapsed } from "./useLiveElapsed";

/**
 * The board. A list on the left, one order open on the right — the shape ops
 * already works in, because the question is almost always "what is happening
 * with KG-2217" while the rest of the board keeps moving.
 */
export function OrdersBoard({
  orders,
  role,
  openOrder,
}: {
  orders: LiveOrder[];
  role: AdminRole;
  openOrder?: string;
}) {
  // Arriving from a ticket ("Open KG-2196") means that order specifically —
  // which may well be delivered or cancelled, so the filter opens wide enough
  // to contain it rather than showing an empty board.
  const [filter, setFilter] = useState<OrderFilter>(openOrder ? "all" : "active");
  const [riderState, setRiderState] = useState<RiderState>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(openOrder ?? null);

  const rows = orders
    .filter((order) => matchesFilter(order, filter))
    .filter((order) => matchesQuery(order, query))
    .filter((order) => matchesRiderState(order, riderState));

  const selected =
    orders.find((order) => order.id === selectedId || order.code === selectedId) ??
    rows[0] ??
    null;

  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <section className="bg-ops-surface ops-scroll-x min-w-0 flex-[4_1_620px] rounded-[15px]">
        <div className="border-text/6 flex flex-wrap items-center gap-2 border-b px-lg py-3.5">
          {ORDER_FILTERS.map((key) => (
            <CountTab
              key={key}
              label={ORDER_FILTER_LABEL[key]}
              count={orders.filter((order) => matchesFilter(order, key)).length}
              selected={filter === key}
              onClick={() => setFilter(key)}
            />
          ))}
          <select
            aria-label="Filter by rider state"
            value={riderState}
            onChange={(event) => setRiderState(event.target.value as RiderState)}
            className="bg-text/6 text-text h-8 rounded-pill px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent"
          >
            {RIDER_STATES.map((state) => <option key={state} value={state}>{RIDER_STATE_LABEL[state]}</option>)}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order, phone, kitchen or rider"
            aria-label="Search orders"
            className="bg-text/6 text-text placeholder:text-text/45 ml-auto h-8 w-[min(260px,100%)] rounded-pill px-3.5 text-[12.5px] font-medium outline-none"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              query
                ? `No orders match “${query}”`
                : orders.length === 0
                  ? "No orders yet"
                  : riderState !== "ALL" ? `No ${RIDER_STATE_LABEL[riderState].toLowerCase()} orders in this view` : `No ${filter === "all" ? "" : `${filter} `}orders`
            }
            text={
              query
                ? "Try an order number, customer phone or kitchen name."
                : "When there are, they'll appear here."
            }
            action={
              query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="border-text/16 text-text mt-2 h-[34px] rounded-pill border px-lg text-[12.5px] font-semibold"
                >
                  Clear search
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="min-w-[700px]">
            {rows.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                selected={selected?.id === order.id}
                onPick={() => setSelectedId(order.id)}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="sticky top-5 min-w-0 max-w-full flex-[1_1_360px]">
        {selected ? (
          <OrderDetail key={selected.id} order={selected} role={role} />
        ) : (
          <div
            data-theme="light"
            className="bg-ops-surface text-text/62 rounded-[15px] px-lg py-[60px] text-center text-[14px]"
          >
            Pick an order to see its details.
          </div>
        )}
      </aside>
    </div>
  );
}

/** The stage a row shows, and how loudly. Waiting for a kitchen to accept is
 *  the one stage that is a warning on its own: the 3-minute clock is running. */
export function stageTone(order: LiveOrder): { tone: Tone; label: string } {
  if (order.refunded) return { tone: "muted", label: "Refunded" };
  if (order.cancelled) return { tone: "muted", label: "Cancelled" };
  if (order.stage === "delivered") return { tone: "success", label: "Delivered" };
  if (order.stage === "on_the_way") return { tone: "info", label: "On the way" };
  if (order.stage === "waiting") return { tone: "warning", label: STAGE_LABEL.waiting };
  if (order.stage === "awaiting_payment") return { tone: "warning", label: STAGE_LABEL.awaiting_payment };
  return { tone: "muted", label: STAGE_LABEL[order.stage] };
}

/* Elapsed and total sit at the right-hand end and are the two columns ops
   scans down. They keep fixed widths so they line up; everything to their
   left gives way first, and the panel scrolls before they are squeezed. */
const ROW_COLUMNS =
  "grid grid-cols-[4px_78px_minmax(96px,1.1fr)_minmax(96px,1.2fr)_minmax(84px,1fr)_minmax(118px,auto)_84px_86px] gap-2.5";

function OrderRow({
  order,
  selected,
  onPick,
}: {
  order: LiveOrder;
  selected: boolean;
  onPick: () => void;
}) {
  const stage = stageTone(order);
  const unassigned = isUnassigned(order);
  const { label, late } = useLiveElapsed(order);

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        ROW_COLUMNS,
        "border-text/6 text-text hover:bg-text/4 w-full items-center border-b pr-lg text-left text-[13.5px] font-normal",
        "min-h-[58px]",
        selected && "bg-accent/8",
      )}
    >
      {/* The one thing visible from across the room: red for late, amber for
          nobody coming to collect it. */}
      <span
        aria-hidden
        className={cn(
          "h-full self-stretch",
          late ? "bg-danger" : unassigned ? "bg-warning" : "bg-transparent",
        )}
      />
      <span className="flex flex-col gap-[3px]">
        <span className="font-bold">{order.code}</span>
        <span className="text-text/55 text-[11.5px] font-light">{order.placedLabel}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="truncate">{order.customerName}</span>
        <span className="text-text/55 text-[11.5px] font-light">{order.customerPhone}</span>
      </span>
      <span className="truncate">{order.kitchens}</span>
      <RiderOperations order={order} />
      <span className="flex flex-wrap gap-[5px]">
        <StatusChip tone={stage.tone}>{stage.label}</StatusChip>
        {late && <StatusChip tone="danger">Late</StatusChip>}
      </span>
      <span className={cn("text-right font-semibold whitespace-nowrap", late ? "text-danger" : "text-text")}>
        {label}
      </span>
      <span className="flex flex-col gap-[3px] text-right">
        <span className="font-bold">{formatKobo(order.totalKobo)}</span>
        <span className="text-text/55 text-[11.5px] font-light">
          {PAYMENT_LABEL[order.payment]}
        </span>
      </span>
    </button>
  );
}
