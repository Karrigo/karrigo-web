import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { SCOPES } from "@/lib/api/scopes";
import { nairaToKobo } from "@/lib/money";
import type { Bank, KitchenApplication, Partner, RiderApplication, StoreApplication } from "./types";

const last4 = (n: string | null | undefined) => (n ? n.slice(-4) : null);

const signedOut = (error: unknown) => error instanceof ApiError && (error.status === 401 || error.status === 403);

/** The backend answers 409 with a code when the business has no such side
 *  yet: that is "nothing to show here", not a failure. */
const missingSide = (error: unknown, code: "NO_KITCHEN" | "NO_STORE") =>
  error instanceof ApiError && error.status === 409 && error.body.code === code;

/**
 * The partner signed in on one side. The kitchen and the store are separate
 * sign-ins that share a business: `kitchenId` / `storeId` say which sides
 * exist, but only the side signed in here is open. Null when that side has no
 * session. One lookup per request, shared by every caller, and none at all
 * without a cookie, which is nearly every visit.
 */
export const getPartner = cache(async (scope: "kitchen" | "store" = "kitchen"): Promise<Partner | null> => {
  if (!(await cookies()).get(SCOPES[scope].access)?.value) return null;
  try {
    const me = await api<Schemas["AuthenticatedKitchenStaffResponseDto"]>("/kitchen-auth/me", { scope });
    return {
      businessId: me.businessId,
      kitchenId: me.kitchenId,
      storeId: me.storeId,
      isOwner: me.staffRole === "OWNER",
    };
  } catch (error) {
    if (signedOut(error)) return null;
    throw error;
  }
});

/** Whether this browser is signed in to a kitchen or a store. Either one makes
 *  it a business visit, which can look around as a customer but not order. */
export async function hasPartnerSession(): Promise<boolean> {
  const [kitchen, store] = await Promise.all([getPartner("kitchen").catch(() => null), getPartner("store").catch(() => null)]);
  return kitchen !== null || store !== null;
}

/** The signed-in kitchen's own application, or null when nobody is signed in
 *  as a partner or the business has no kitchen yet. */
export async function getKitchenApplication(): Promise<KitchenApplication | null> {
  try {
    const [k, me] = await Promise.all([
      api<Schemas["KitchenWithMenuResponseDto"]>("/kitchen-console/kitchen", { scope: "kitchen" }),
      api<Schemas["AuthenticatedKitchenStaffResponseDto"]>("/kitchen-auth/me", { scope: "kitchen" }),
    ]);
    return {
      name: k.name,
      status: k.status,
      note: k.rejectionNote ?? null,
      appealNote: k.appealNote ?? null,
      appealedAt: k.appealedAt ?? null,
      appealResponse: k.appealResponse ?? null,
      neverApproved: !k.firstApprovedAt,
      area: k.area ?? null,
      landmarkNote: k.landmarkNote ?? null,
      hasLocation: k.lat != null && k.lng != null,
      bankAccountName: k.payoutAccountName ?? null,
      bankAccountLast4: last4(k.payoutAccountNumber),
      imageUrl: k.heroImageUrl ?? null,
      isOwner: me.staffRole === "OWNER",
      // An older server has neither field: nothing set, no photos.
      riderBaseFeeKobo: k.riderBaseFeeNaira == null ? null : nairaToKobo(k.riderBaseFeeNaira),
      verificationPhotoCount: k.verificationPhotoCount ?? 0,
      dishes: k.sections.flatMap((s) =>
        s.items.map((i) => ({ id: i.id, name: i.name, priceKobo: nairaToKobo(i.priceNaira) })),
      ),
    };
  } catch (error) {
    if (signedOut(error) || missingSide(error, "NO_KITCHEN")) return null;
    throw error;
  }
}

/** The signed-in store's own application, or null when nobody is signed in as
 *  a partner or the business has no store yet. */
export async function getStoreApplication(): Promise<StoreApplication | null> {
  try {
    const [s, partner] = await Promise.all([
      api<Schemas["StoreConsoleResponseDto"]>("/store-console/store", { scope: "store" }),
      getPartner("store"),
    ]);
    return {
      name: s.name,
      status: s.status,
      note: s.rejectionNote ?? null,
      appealNote: s.appealNote ?? null,
      appealedAt: s.appealedAt ?? null,
      appealResponse: s.appealResponse ?? null,
      neverApproved: !s.firstApprovedAt,
      area: s.area ?? null,
      landmarkNote: s.landmarkNote ?? null,
      hasLocation: s.lat != null && s.lng != null,
      bankAccountName: s.payoutAccountName ?? null,
      bankAccountLast4: last4(s.payoutAccountNumber),
      imageUrl: s.heroImageUrl ?? null,
      isOwner: partner?.isOwner ?? false,
      riderBaseFeeKobo: s.riderBaseFeeNaira == null ? null : nairaToKobo(s.riderBaseFeeNaira),
      verificationPhotoCount: s.verificationPhotoCount ?? 0,
      missing: s.missing ?? [],
    };
  } catch (error) {
    if (signedOut(error) || missingSide(error, "NO_STORE")) return null;
    throw error;
  }
}

/** The signed-in customer's rider profile, or null if they have not started
 *  one (the backend answers 403: "not a rider"). */
export async function getRiderApplication(): Promise<RiderApplication | null> {
  try {
    const r = await api<Schemas["RiderOwnProfileResponseDto"]>("/riders/me", { scope: "customer" });
    return {
      status: r.verificationStatus,
      note: r.rejectionNote ?? null,
      vehicleType: r.vehicleType ?? null,
      plateNumber: r.plateNumber ?? null,
      documents: { license: !!r.licenseDocUrl, id: !!r.idDocUrl, vehicleReg: !!r.vehicleRegDocUrl },
      guarantor:
        r.guarantorName && r.guarantorPhone
          ? { name: r.guarantorName, phone: r.guarantorPhone, address: r.guarantorAddress ?? "" }
          : null,
      bankAccountName: r.payoutAccountName ?? null,
      bankAccountLast4: last4(r.payoutAccountNumber),
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}

/** Paystack's bank list. It barely changes, so an hour's cache is safe — and
 *  it is not a price. Sorted, and de-duplicated by code. */
export async function listBanks(): Promise<Bank[]> {
  try {
    const banks = await api<Schemas["BankResponseDto"][]>("/payments/banks", { revalidate: 3600 });
    const seen = new Set<string>();
    return banks
      .filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)))
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // The form says so; an applicant can still do every other step.
    return [];
  }
}
