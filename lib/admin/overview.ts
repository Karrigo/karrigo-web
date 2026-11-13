import "server-only";

import { cache } from "react";

import { api, type Schemas } from "@/lib/api/client";
import { nairaToKobo } from "@/lib/money";
import { formatKobo } from "@/lib/money";
import { ageLabel, durationLabel } from "./format";
import { ACCEPT_WINDOW_MINUTES, isActive, liveOrder, type LiveOrder } from "./orders";
import type { OrderStage } from "./types";

/**
 * Everything the overview shows, fetched together. The numbers across the top
 * come from the dashboard endpoint (one aggregate call, Lagos calendar day);
 * the live pipeline is counted from the open orders themselves.
 */

export type OverviewView = {
  generatedAt: string;
  kpis: { label: string; value: string; versus: string; delta: string | null; good: boolean }[];
  trend: { day: string; orders: number; isToday: boolean }[];
  attention: {
    id: string;
    severity: "danger" | "warning";
    title: string;
    meta: string;
    href: string;
    action: string;
  }[];
  pipeline: { stage: OrderStage; label: string; count: number; oldestMinutes: number; slow: boolean }[];
  openOrders: number;
  kitchens: { id: string; name: string; area: string; open: boolean; rating: string; riderBaseFeeKobo: number | null }[];
  activity: { time: string; text: string }[];
};

const STAGES: { stage: OrderStage; label: string }[] = [
  { stage: "waiting", label: "Waiting for kitchen" },
  { stage: "awaiting_payment", label: "Awaiting payment" },
  { stage: "accepted", label: "Accepted" },
  { stage: "cooking", label: "Cooking" },
  { stage: "ready", label: "Ready" },
  { stage: "on_the_way", label: "On the way" },
];

function delta(now: number, before: number | undefined): { delta: string | null; up: boolean } {
  if (before === undefined || before === 0) return { delta: null, up: true };
  const pct = Math.round(((now - before) / before) * 100);
  return { delta: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}%`, up: pct >= 0 };
}

const AUDIT_VERB: Record<string, string> = {};

function describe(entry: Schemas["AuditLogEntryDto"]): string {
  // Not every entry is an admin's: a rider resubmitting for review is
  // recorded with the rider as the actor.
  const who = entry.actorAdmin
    ? entry.actorAdmin.name
    : entry.actorKitchenStaff
      ? entry.actorKitchenStaff.name
      : entry.actorUser
        ? (entry.actorUser.name ?? entry.actorUser.phone ?? "Customer")
        : "System";
  const action = (AUDIT_VERB[entry.action] ?? entry.action.replace(/[._]/g, " ").toLowerCase());
  return `${who} · ${action} · ${entry.entity.toLowerCase()}`;
}

/** One call per request, shared by the sidebar badges and the overview. */
export const getSummary = cache(() =>
  api<Schemas["DashboardSummaryDto"]>("/admin/dashboard/summary", {
    scope: "admin",
    query: { days: 14 },
  }),
);

export async function loadNavCounts(): Promise<{ kitchens: number; riders: number; issues: number }> {
  try {
    const { queues } = await getSummary();
    return {
      kitchens: queues.pendingKitchens,
      riders: queues.pendingRiderReviews,
      issues: queues.openTickets,
    };
  } catch {
    // A badge is a courtesy. Never let it take the page down.
    return { kitchens: 0, riders: 0, issues: 0 };
  }
}

export async function loadOverview(): Promise<OverviewView> {
  const [summary, orderPage, kitchens, audit] = await Promise.all([
    getSummary(),
    api<Schemas["AdminOrderPageDto"]>("/admin/orders", { scope: "admin", query: { pageSize: 100 } }),
    api<Schemas["KitchenResponseDto"][]>("/admin/kitchens", { scope: "admin", query: { status: "ACTIVE" } }),
    api<Schemas["AuditLogPageDto"]>("/admin/audit-log", { scope: "admin", query: { pageSize: 8 } }),
  ]);

  const orders: LiveOrder[] = orderPage.items.map((o) => liveOrder(o));
  const open = orders.filter(isActive);

  const { today, trend, queues, live, payoutsDue } = summary;
  const todayDay = trend.at(-1)?.day;
  const lastWeek = trend.find((t) => t.day === shiftDay(todayDay, -7));

  const ordersDelta = delta(today.ordersPlaced, lastWeek?.orders);
  const gmvDelta = delta(today.gmvNaira, lastWeek?.gmvNaira);

  const kpis: OverviewView["kpis"] = [
    {
      label: "Orders today",
      value: String(today.ordersPlaced),
      versus: "vs same day last week",
      delta: ordersDelta.delta,
      good: ordersDelta.up,
    },
    {
      label: "Sales today",
      value: formatKobo(nairaToKobo(today.gmvNaira)),
      versus: "vs same day last week",
      delta: gmvDelta.delta,
      good: gmvDelta.up,
    },
    { label: "Delivered", value: String(today.ordersDelivered), versus: "today", delta: null, good: true },
    {
      label: "Cancelled",
      value: String(today.ordersCancelled),
      versus: "today",
      delta: null,
      good: today.ordersCancelled === 0,
    },
    { label: "New customers", value: String(today.newCustomers), versus: "today", delta: null, good: true },
    {
      label: "Riders free",
      value: `${live.ridersAvailable}`,
      versus: `${live.ridersOnDelivery} on a delivery`,
      delta: null,
      good: live.ridersAvailable > 0 || live.activeOrders === 0,
    },
  ];

  const attention: OverviewView["attention"] = [];
  for (const o of orders.filter((x) => x.late)) {
    attention.push({
      id: `late-${o.id}`,
      severity: "danger",
      title:
        o.status === "PLACED"
          ? `${o.code}: ${o.kitchens} hasn't accepted in ${ACCEPT_WINDOW_MINUTES} minutes`
          : `${o.code} is running late, ${durationLabel(o.elapsedMinutes)}`,
      meta: `${o.customerName} · ${o.customerPhone}`,
      href: `/orders?order=${o.code}`,
      action: "Open order",
    });
  }
  if (queues.pendingKitchens)
    attention.push({
      id: "kitchens",
      severity: "warning",
      title: `${queues.pendingKitchens} kitchen${queues.pendingKitchens === 1 ? "" : "s"} waiting for approval`,
      meta: "Nobody can order from them until they're approved",
      href: "/kitchens",
      action: "Review",
    });
  if (queues.pendingRiderReviews)
    attention.push({
      id: "riders",
      severity: "warning",
      title: `${queues.pendingRiderReviews} rider${queues.pendingRiderReviews === 1 ? "" : "s"} waiting for review`,
      meta: "They can't go online until approved",
      href: "/riders",
      action: "Review",
    });
  if (queues.openTickets)
    attention.push({
      id: "tickets",
      severity: "warning",
      title: `${queues.openTickets} open issue${queues.openTickets === 1 ? "" : "s"}`,
      meta: `${queues.inProgressTickets} more in progress`,
      href: "/issues",
      action: "Open",
    });
  const owed = payoutsDue.totalKitchenNetNaira + payoutsDue.totalRiderNetNaira;
  if (owed > 0)
    attention.push({
      id: "payouts",
      severity: "warning",
      title: `${formatKobo(nairaToKobo(owed))} due for payout`,
      meta: `${payoutsDue.kitchenCount} kitchen${payoutsDue.kitchenCount === 1 ? "" : "s"} · ${payoutsDue.riderCount} rider${payoutsDue.riderCount === 1 ? "" : "s"}`,
      href: "/money",
      action: "Go to money",
    });

  return {
    generatedAt: summary.generatedAt,
    kpis,
    trend: trend.map((t) => ({ day: t.day, orders: t.orders, isToday: t.day === todayDay })),
    attention,
    pipeline: STAGES.map(({ stage, label }) => {
      const inStage = open.filter((o) => o.stage === stage);
      const oldestMinutes = Math.max(0, ...inStage.map((o) => o.elapsedMinutes));
      return {
        stage,
        label,
        count: inStage.length,
        oldestMinutes,
        slow: stage === "waiting" && oldestMinutes > ACCEPT_WINDOW_MINUTES,
      };
    }),
    openOrders: open.length,
    kitchens: kitchens
      .map((k) => ({
        id: k.id,
        name: k.name,
        area: k.area ?? "—",
        open: k.isOpen,
        rating: k.ratingsCount ? `${k.ratingAvg.toFixed(1)} (${k.ratingsCount})` : "New",
        // Not the legacy feeNaira (0 for new kitchens); null = not set yet.
        riderBaseFeeKobo: k.riderBaseFeeNaira != null ? nairaToKobo(k.riderBaseFeeNaira) : null,
      }))
      .sort((a, b) => Number(b.open) - Number(a.open) || a.name.localeCompare(b.name)),
    activity: audit.items.map((e) => ({ time: ageLabel(e.createdAt), text: describe(e) })),
  };
}

function shiftDay(day: string | undefined, by: number): string {
  if (!day) return "";
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}
