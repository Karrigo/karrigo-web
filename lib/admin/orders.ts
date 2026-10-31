import type { Schemas } from "@/lib/api/types";
import { formatKobo, nairaToKobo } from "@/lib/money";
import { ageLabel, durationLabel, whenLabel } from "./format";
import { type OrderStage, type PaymentMethod } from "./types";

/**
 * An order as ops reads it on the board, built from karrigo-be's admin order
 * list. The backend has no notion of "late" or of a rider being "assigned" by
 * hand (riders accept broadcast offers), so those are derived here, in one
 * place, and stated as policy.
 */

type Status = Schemas["AdminOrderListItemDto"]["status"];

/** An order still waiting for a kitchen past this is the 3-minute rule being
 *  broken (CLAUDE.md: kitchens have 3 minutes to accept). */
export const ACCEPT_WINDOW_MINUTES = 3;
/** Past this, any order still in flight is running late. The product has not
 *  fixed a delivery promise yet, so this is ops' working number. */
export const LATE_AFTER_MINUTES = 45;

const STAGE: Record<Status, OrderStage> = {
  PLACED: "waiting",
  AWAITING_PAYMENT: "awaiting_payment",
  ACCEPTED: "accepted",
  PREPARING: "cooking",
  READY: "ready",
  PICKED_UP: "on_the_way",
  DELIVERING: "on_the_way",
  DELIVERED: "delivered",
  CANCELLED: "waiting",
  REFUNDED: "delivered",
};

export type LiveOrder = {
  id: string;
  /** The number said out loud — "KG-2217". */
  code: string;
  status: Status;
  stage: OrderStage;
  cancelled: boolean;
  refunded: boolean;
  late: boolean;
  elapsedMinutes: number;
  placedAt: string;
  placedLabel: string;
  acceptedAt: string | null;
  paymentDueAt: string | null;
  paidAt: string | null;
  cancelReason: Schemas["AdminOrderListItemDto"]["cancelReason"];
  customerId: string;
  customerName: string;
  customerPhone: string;
  kitchens: string;
  riderName: string | null;
  riderId: string | null;
  currentRiderAcceptedAt: string | null;
  assignmentCount: number;
  reassignmentCount: number;
  riderWait: Schemas["AdminRiderWaitDto"];
  payment: PaymentMethod;
  paymentStatus: Schemas["AdminPaymentDto"]["status"] | null;
  totalKobo: number;
};

/** `channel` is the real method only once Paystack confirms payment — before
 *  that, and for any method the backend doesn't map, it's a placeholder
 *  (SYNC_WEB_ADMIN.md §3). Show "Paid online" rather than a wrong label. */
export function paymentMethodOf(payment: Schemas["AdminPaymentDto"] | undefined): PaymentMethod {
  if (!payment || payment.provider === "CASH") return "cash";
  if (payment.status !== "SUCCEEDED") return "online";
  switch (payment.channel) {
    case "BANK_TRANSFER":
      return "transfer";
    case "USSD":
      return "ussd";
    case "CARD":
      return "card";
    default:
      return "online";
  }
}

/** Whether an order still in flight has run past its window. Shared with the
 *  boards, which re-evaluate it every second as the clock ticks. */
export function isLate(status: Status, elapsedMinutes: number): boolean {
  return status === "PLACED"
    ? elapsedMinutes > ACCEPT_WINDOW_MINUTES
    : elapsedMinutes > LATE_AFTER_MINUTES;
}

export function liveOrder(o: Schemas["AdminOrderListItemDto"], now = new Date()): LiveOrder {
  const cancelled = o.status === "CANCELLED";
  const refunded = o.status === "REFUNDED";
  const over = cancelled || refunded || o.status === "DELIVERED";
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(o.placedAt).getTime()) / 60_000),
  );
  const payment = o.payments[0];

  return {
    id: o.id,
    code: o.code,
    status: o.status,
    stage: STAGE[o.status],
    cancelled,
    refunded,
    late: !over && isLate(o.status, elapsedMinutes),
    elapsedMinutes,
    placedAt: o.placedAt,
    placedLabel: whenLabel(o.placedAt, now),
    acceptedAt: o.acceptedAt,
    paymentDueAt: o.paymentDueAt,
    paidAt: o.paidAt,
    cancelReason: o.cancelReason,
    customerId: o.customerId,
    customerName: o.customer.name ?? o.customer.phone,
    customerPhone: o.customer.phone,
    kitchens: o.kitchenOrders.map((k) => k.kitchen.name).join(" + ") || "—",
    riderName: o.rider ? (o.rider.user.name ?? o.rider.user.phone) : null,
    riderId: o.riderId,
    currentRiderAcceptedAt: o.currentRiderAcceptedAt,
    assignmentCount: o.assignmentCount,
    reassignmentCount: o.reassignmentCount,
    riderWait: o.riderWait,
    payment: paymentMethodOf(payment),
    paymentStatus: payment?.status ?? null,
    totalKobo: nairaToKobo(o.totalNaira),
  };
}

export const RIDER_STATES = ["ALL", "UNASSIGNED", "ASSIGNED", "REASSIGNED"] as const;
export type RiderState = (typeof RIDER_STATES)[number];
export const RIDER_STATE_LABEL: Record<RiderState, string> = {
  ALL: "All rider states",
  UNASSIGNED: "Unassigned",
  ASSIGNED: "Assigned",
  REASSIGNED: "Reassigned",
};

/** Reassignments are history, so an unassigned order can also be reassigned. */
export function matchesRiderState(order: LiveOrder, state: RiderState): boolean {
  if (state === "UNASSIGNED") return order.riderId === null;
  if (state === "ASSIGNED") return order.riderId !== null;
  if (state === "REASSIGNED") return order.assignmentCount >= 2;
  return true;
}

function waitLabel(seconds: number): string {
  return seconds < 60 ? `${Math.max(0, Math.floor(seconds))} sec` : durationLabel(seconds / 60);
}

/** Advance only a running wait from its server measurement. Known initial
 * wait and terminal totals stay fixed. The default is hydration-stable. */
export function riderOperationsView(order: LiveOrder, now = new Date(order.riderWait.measuredAt)) {
  const wait = order.riderWait;
  const waiting = wait.currentWaitStartedAt !== null && isActive(order) && order.riderId === null;
  const extraSeconds = waiting
    ? Math.max(0, Math.floor((now.getTime() - new Date(wait.measuredAt).getTime()) / 1000))
    : 0;
  const totalWaitSeconds = wait.totalWaitSeconds + extraSeconds;
  const partial = wait.isPartial || wait.initialWaitSeconds === null;
  const currentWaitLabel = waiting ? waitLabel(wait.currentWaitSeconds + extraSeconds) : "—";
  return {
    name: order.riderName ?? (order.riderId ? "Assigned rider" : waiting ? "Waiting for rider" : "No rider assigned"),
    timing: order.riderId
      ? order.currentRiderAcceptedAt
        ? `Accepted ${ageLabel(order.currentRiderAcceptedAt, now)}`
        : "Acceptance time unknown"
      : waiting ? currentWaitLabel : "",
    initialWaitLabel: wait.initialWaitSeconds === null
      ? "Unknown"
      : waitLabel(wait.initialWaitSeconds + (order.assignmentCount === 0 ? extraSeconds : 0)),
    totalWaitLabel: partial
      ? totalWaitSeconds > 0 ? `At least ${waitLabel(totalWaitSeconds)}` : "Unknown"
      : waitLabel(totalWaitSeconds),
    currentWaitLabel,
    reassignmentLabel: order.reassignmentCount > 0 ? `Reassigned ${order.reassignmentCount}×` : null,
  };
}

export function isActive(order: LiveOrder): boolean {
  return !order.cancelled && !order.refunded && order.stage !== "delivered";
}

/** No rider on an order that is on or past `ready` — the food is getting cold
 *  while nobody is coming for it. */
export function isUnassigned(order: LiveOrder): boolean {
  return (
    order.riderName === null &&
    isActive(order) &&
    (order.stage === "ready" || order.stage === "on_the_way")
  );
}

export const ORDER_FILTERS = ["active", "late", "delivered", "cancelled", "all"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export const ORDER_FILTER_LABEL: Record<OrderFilter, string> = {
  active: "Active",
  late: "Late",
  delivered: "Delivered",
  cancelled: "Cancelled",
  all: "All",
};

export function matchesFilter(order: LiveOrder, filter: OrderFilter): boolean {
  switch (filter) {
    case "active":
      return isActive(order);
    case "late":
      return order.late;
    case "delivered":
      return order.status === "DELIVERED";
    case "cancelled":
      return order.cancelled || order.refunded;
    case "all":
      return true;
  }
}

/** One box for everything ops might have in hand: a number read off a
 *  screenshot, a phone number read out over the line, a kitchen name. */
export function matchesQuery(order: LiveOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.code, order.customerName, order.customerPhone, order.kitchens, order.riderName ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

/* ---------------------------------------------------------------- detail */

export type OrderDetailView = {
  riderOperations: Pick<LiveOrder, "riderId" | "riderName" | "currentRiderAcceptedAt" | "assignmentCount" | "reassignmentCount" | "riderWait">;
  riderAssignments: {
    id: string;
    riderName: string;
    status: Schemas["AdminRiderAssignmentDto"]["status"];
    acceptedAt: string | null;
    endedAt: string | null;
    reason: string | null;
    note: string | null;
  }[];
  address: string;
  instructions: string | null;
  items: { name: string; qty: number; unitPriceKobo: number }[];
  subtotalKobo: number;
  feeKobo: number;
  discountKobo: number;
  creditKobo: number;
  tipKobo: number;
  totalKobo: number;
  promoCode: string | null;
  timeline: { label: string; time: string; reached: boolean; current: boolean }[];
  /** Admin actions already taken on it, newest last. */
  log: { event: string; at: string; by: string }[];
  tickets: { id: string; subject: string; status: string }[];
};

const ABANDON_REASON_LABEL: Record<NonNullable<Schemas["AdminRiderAssignmentDto"]["abandonReason"]>, string> = {
  VEHICLE_PROBLEM: "Vehicle problem",
  EMERGENCY: "Emergency",
  KITCHEN_DELAY: "Kitchen delay",
  CUSTOMER_UNREACHABLE: "Customer unreachable",
  OTHER: "Other",
};

export function orderDetailView(o: Schemas["AdminOrderDetailDto"]): OrderDetailView {
  const steps: { label: string; at: string | null }[] = [
    { label: "Placed", at: o.placedAt },
    { label: "Every kitchen accepted", at: o.acceptedAt },
    { label: "Paid", at: o.paidAt },
    { label: "Rider at the kitchen", at: o.riderArrivedAtKitchenAt },
    { label: "Picked up", at: o.pickedUpAt },
    { label: "Delivered", at: o.deliveredAt },
  ];
  const lastReached = steps.reduce((last, s, i) => (s.at ? i : last), 0);
  const ended = o.status === "DELIVERED" || o.status === "CANCELLED" || o.status === "REFUNDED";

  return {
    riderOperations: {
      riderId: o.riderId,
      riderName: o.rider ? (o.rider.user.name ?? o.rider.user.phone) : null,
      currentRiderAcceptedAt: o.currentRiderAcceptedAt,
      assignmentCount: o.assignmentCount,
      reassignmentCount: o.reassignmentCount,
      riderWait: o.riderWait,
    },
    riderAssignments: o.riderAssignments.map((assignment) => ({
      id: assignment.id,
      riderName: assignment.rider.user.name ?? assignment.rider.user.phone,
      status: assignment.status,
      acceptedAt: assignment.acceptedAt,
      endedAt: assignment.endedAt,
      reason: assignment.abandonReason ? ABANDON_REASON_LABEL[assignment.abandonReason] : null,
      note: assignment.abandonNote,
    })),
    address: `${o.address.line1}, ${o.address.area}`,
    instructions: o.address.instructions ?? null,
    items: o.kitchenOrders.flatMap((k) =>
      k.items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        unitPriceKobo: nairaToKobo(i.unitPriceNaira),
      })),
    ),
    subtotalKobo: nairaToKobo(o.subtotalNaira),
    feeKobo: nairaToKobo(o.deliveryFeeNaira),
    discountKobo: nairaToKobo(o.discountNaira),
    creditKobo: nairaToKobo(o.creditAppliedNaira),
    tipKobo: nairaToKobo(o.tipNaira),
    totalKobo: nairaToKobo(o.totalNaira),
    promoCode: o.promoCode ?? null,
    timeline: steps.map((s, i) => ({
      label: s.label,
      time: s.at ? whenLabel(s.at) : "—",
      reached: !!s.at,
      current: !!s.at && i === lastReached && !ended,
    })),
    log: o.timeline.map((t) => ({ event: t.event, at: ageLabel(t.at), by: t.adminName ?? "An admin" })),
    tickets: o.supportTickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status })),
  };
}

export function money(kobo: number): string {
  return formatKobo(kobo);
}
