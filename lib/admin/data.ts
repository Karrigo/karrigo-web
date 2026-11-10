import "server-only";

import { api, type Schemas } from "@/lib/api/client";
import type { Ticket } from "./types";
import { ageLabel } from "./format";
import { kitchenItem, riderItem, storeItem, type QueueItem, type QueueKind } from "./queue";
import { staffWorkplace } from "./staff";
import { verifiedQuery, type VerifiedFilter } from "./verified";

/**
 * The queue for kitchens or riders, with what each is owed folded in from the
 * payouts-due endpoint — the same rows and arithmetic the payout itself uses,
 * so the figure on screen is the figure that will be sent.
 */
export async function loadQueue(kind: QueueKind, verified: VerifiedFilter = "all"): Promise<QueueItem[]> {
  const query = { verified: verifiedQuery(verified) };
  if (kind === "stores") {
    const stores = await api<Schemas["StoreResponseDto"][]>("/admin/stores", { scope: "admin", query });
    const details = await Promise.all(
      stores.map((store) =>
        api<Schemas["AdminStoreDetailDto"]>(`/admin/stores/${encodeURIComponent(store.id)}`, {
          scope: "admin",
        }),
      ),
    );
    return stores
      .map((store, index) => storeItem(store, details[index]))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const [due, items] = await Promise.all([
    api<Schemas["PayoutsDueResponseDto"]>("/admin/payouts/due", { scope: "admin" }),
    kind === "kitchens"
      ? api<Schemas["KitchenResponseDto"][]>("/admin/kitchens", { scope: "admin", query })
      : api<Schemas["AdminRiderListItemDto"][]>("/admin/riders", { scope: "admin" }),
  ]);

  const built =
    kind === "kitchens"
      ? (items as Schemas["KitchenResponseDto"][]).map((k) =>
          kitchenItem(k, due.kitchens.find((d) => d.kitchenId === k.id)),
        )
      : (items as Schemas["AdminRiderListItemDto"][]).map((r) =>
          riderItem(r, due.riders.find((d) => d.riderId === r.id)),
        );

  // Oldest first: an application sitting for three days is a kitchen that
  // has probably given up on us.
  return built.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function fromWhatsApp(phone: string | null | undefined): string {
  // wa.me wants digits only, international format.
  return (phone ?? "").replace(/\D/g, "");
}

/** Tickets from every actor, newest first within each status. */
export async function loadTickets(): Promise<Ticket[]> {
  const page = await api<Schemas["AdminTicketPageDto"]>("/admin/support-tickets", {
    scope: "admin",
    query: { pageSize: 100 },
  });

  return page.items.map((t): Ticket => {
    const staff = t.kitchenStaff;
    const fromType = staff ? "Kitchen" : t.user?.role === "RIDER" ? "Rider" : "Customer";
    return {
      id: t.id,
      subject: t.subject,
      body: t.body ?? "No details were added.",
      fromType,
      fromName: staff
        ? [staff.name, staffWorkplace(staff)].filter(Boolean).join(" · ")
        : (t.user?.name ?? t.user?.phone ?? "Unknown"),
      channel: t.channel,
      orderId: t.order?.code ?? null,
      status: t.status,
      age: ageLabel(t.createdAt),
      phone: fromWhatsApp(staff?.phone ?? t.user?.phone),
    };
  });
}

export type MoneyView = {
  kitchens: Schemas["KitchenPayoutDueDto"][];
  riders: Schemas["RiderPayoutDueDto"][];
  recent: Schemas["AdminTransactionDto"][];
};

export async function loadMoney(): Promise<MoneyView> {
  const [due, ledger] = await Promise.all([
    api<Schemas["PayoutsDueResponseDto"]>("/admin/payouts/due", { scope: "admin" }),
    api<Schemas["AdminTransactionPageDto"]>("/admin/transactions", {
      scope: "admin",
      query: { pageSize: 12 },
    }),
  ]);
  return { kitchens: due.kitchens, riders: due.riders, recent: ledger.items };
}
