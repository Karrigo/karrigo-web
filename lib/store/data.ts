import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { SCOPES } from "@/lib/api/scopes";
import type { Earnings, KitchenOrder, MenuSection, Payout, StaffRole } from "@/lib/kitchen/types";
import { initialCategoryIds } from "@/lib/categories";
import { nairaToKobo } from "@/lib/money";
import { getPartner } from "@/lib/partners/data";

/** Where an approved store is run from, and where one that is not approved
 *  yet finishes its application. */
export const STORE_CONSOLE = "/my-store";
export const STORE_APPLICATION = "/partners/store";

const signedOut = (error: unknown) => error instanceof ApiError && (error.status === 401 || error.status === 403);

/** A kitchen-only business is signed in but has no store: 409 NO_STORE. */
const noStore = (error: unknown) => error instanceof ApiError && error.status === 409 && error.body.code === "NO_STORE";

export type Store = {
  name: string;
  slug: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  role: StaffRole;
  isOpen: boolean;
  notice: string;
  riderBaseFeeKobo: number | null;
  /** What is still needed before the store may open. */
  missing: ("LOCATION" | "RIDER_FEE")[];
};

/**
 * The signed-in staff member's store, or null. One lookup per request, and
 * none at all for the customers who make up nearly every visit: without a
 * partner cookie there is nobody to ask about.
 */
export const getStore = cache(async (): Promise<Store | null> => {
  const jar = await cookies();
  if (!jar.get(SCOPES.store.access)?.value) return null;

  try {
    const [s, me] = await Promise.all([
      api<Schemas["StoreConsoleResponseDto"]>("/store-console/store", { scope: "store" }),
      api<Schemas["AuthenticatedKitchenStaffResponseDto"]>("/kitchen-auth/me", { scope: "store" }),
    ]);
    return {
      name: s.name,
      slug: s.slug,
      status: s.status,
      role: me.staffRole,
      isOpen: s.isOpen,
      notice: s.noticeText ?? "",
      riderBaseFeeKobo: s.riderBaseFeeNaira == null ? null : nairaToKobo(s.riderBaseFeeNaira),
      missing: s.missing ?? [],
    };
  } catch (error) {
    if (signedOut(error) || noStore(error)) return null;
    throw error;
  }
});

/** The guard on every store console page (CLAUDE.md rule 3). Nobody signed in
 *  goes to the store login; a store ops has not approved goes back to its
 *  application, the only thing it can usefully do. */
export async function requireStore(): Promise<Store> {
  const store = await getStore();
  if (!store) {
    // Signed in without a store (a kitchen-only business) is not a login
    // problem: send them where they can register one.
    redirect((await getPartner("store")) ? STORE_APPLICATION : `${STORE_APPLICATION}/login`);
  }
  if (store.status !== "ACTIVE") redirect(STORE_APPLICATION);
  return store;
}

/** Earnings, payouts, the catalog and settings belong to the owner; the
 *  backend refuses staff, and this keeps them off a page of refusals. */
export async function requireStoreOwner(): Promise<Store> {
  const store = await requireStore();
  if (store.role !== "OWNER") redirect(STORE_CONSOLE);
  return store;
}

/** The catalog as sections of products, in the shape the menu editor shows.
 *  A store sells groceries only, so every section is GROCERY. */
export async function getStoreSections(): Promise<MenuSection[]> {
  const sections = await api<Schemas["StoreSectionWithProductsResponseDto"][]>("/store-console/catalog", {
    scope: "store",
  });
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      id: s.id,
      label: s.label,
      note: s.note ?? "",
      type: "GROCERY" as const,
      dishes: [...s.products]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          sectionId: p.sectionId,
          name: p.name,
          description: p.description ?? "",
          priceKobo: nairaToKobo(p.priceNaira),
          imageUrl: p.imageUrl ?? null,
          unit: p.unit ?? "",
          categoryIds: initialCategoryIds((p as { categories?: { id: string }[] }).categories),
          soldOut: p.isSoldOut,
          flag: p.flaggedAt
            ? {
                at: p.flaggedAt,
                note: p.flagNote ?? "",
                appealNote: p.flagAppealNote,
                appealedAt: p.flagAppealedAt,
                appealResponse: p.flagAppealResponse ?? null,
              }
            : null,
        })),
    }));
}

/** Every order the store has. Cached for the request: the console's layout
 *  and the orders page both ask. */
export const listStoreOrders = cache(async (): Promise<KitchenOrder[]> => {
  const orders = await api<Schemas["StoreOrderWithDetailsResponseDto"][]>("/store-console/orders", {
    scope: "store",
  });
  return orders.map((o) => ({
    id: o.id,
    code: o.order.code,
    status: o.status,
    placedAt: o.order.placedAt,
    area: o.order.address?.area ?? "",
    subtotalKobo: nairaToKobo(o.subtotalNaira),
    type: "GROCERY" as const,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.nameSnapshot,
      qty: i.qty,
      unitPriceKobo: nairaToKobo(i.unitPriceNaira),
      unavailable: i.unavailable,
    })),
    order: {
      status: o.order.status,
      paymentDueAt: o.order.paymentDueAt,
      paidAt: o.order.paidAt,
    },
  }));
});

export async function getStoreEarnings(): Promise<Earnings> {
  const e = await api<Schemas["StoreEarningsSummaryResponseDto"]>("/store-console/store/earnings-summary", {
    scope: "store",
  });
  return {
    commissionRate: e.commissionRate,
    groceryCommissionRate: e.groceryCommissionRate,
    salesKobo: nairaToKobo(e.salesNaira),
    commissionKobo: nairaToKobo(e.commissionNaira),
    nextPayoutKobo: nairaToKobo(e.nextPayoutNaira),
    nextPayoutOrders: e.nextPayoutOrders,
    nextPayoutDaysAway: e.nextPayoutDaysAway,
  };
}

export async function listStorePayouts(): Promise<Payout[]> {
  const payouts = await api<Schemas["StorePayoutResponseDto"][]>("/store-console/store/payouts", {
    scope: "store",
  });
  return payouts.map((p) => ({
    id: p.id,
    amountKobo: nairaToKobo(p.amountNaira),
    status: p.status,
    at: p.settledAt ?? p.createdAt,
    orders: p.storeOrdersPaidOut.length,
  }));
}
