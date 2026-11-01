"use server";

import { revalidatePath } from "next/cache";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { approvalBlockedMessage } from "@/lib/admin/approval";
import { VERIFICATION_PHOTOS_REQUIRED, photosNeededText } from "@/lib/kitchen/types";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin/session";
import { formatKobo, nairaToKobo } from "@/lib/money";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof ApiError) return { ok: false, error: error.message };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "That didn't go through. Try again." };
}

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function setKitchenStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
  note: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const kitchen = await api<Schemas["KitchenResponseDto"]>(`/admin/kitchens/${id}/status`, {
      method: "PATCH",
      scope: "admin",
      body: { status, ...(note ? { note } : {}) },
    });
    refresh();
    return {
      ok: true,
      message: status === "ACTIVE" ? `${kitchen.name} is live` : `${kitchen.name} suspended`,
    };
  } catch (error) {
    // Approving needs all the kitchen photos. The button is disabled before
    // this happens, so this is only a stale screen; say the same thing.
    if (error instanceof ApiError && error.status === 422 && error.body.code === "VERIFICATION_PHOTOS_REQUIRED") {
      const details = (error.body.details ?? {}) as { required?: number; have?: number };
      return {
        ok: false,
        error: photosNeededText(details.have ?? 0, details.required ?? VERIFICATION_PHOTOS_REQUIRED),
      };
    }
    const blocked = error instanceof ApiError && error.status === 422 ? approvalBlockedMessage("kitchen", error.body) : null;
    if (blocked) return { ok: false, error: blocked };
    return fail(error);
  }
}

export async function setRiderVerification(
  id: string,
  status: "APPROVED" | "REJECTED",
  note: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (status === "REJECTED" && !note.trim()) {
      return { ok: false, error: "Add a reason — the rider sees it." };
    }
    await api(`/admin/riders/${id}/verification`, {
      method: "PATCH",
      scope: "admin",
      body: { status, ...(note ? { note } : {}) },
    });
    refresh();
    return { ok: true, message: status === "APPROVED" ? "Rider approved" : "Rider rejected" };
  } catch (error) {
    return fail(error);
  }
}

export async function setStoreStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
  note: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (status === "SUSPENDED" && !note.trim()) {
      return { ok: false, error: "Add a reason — the store owner sees it." };
    }
    const store = await api<Schemas["StoreResponseDto"]>(
      `/admin/stores/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        scope: "admin",
        body: { status, ...(note.trim() ? { note: note.trim() } : {}) },
      },
    );
    refresh();
    return {
      ok: true,
      message: status === "ACTIVE" ? `${store.name} is live` : `${store.name} suspended`,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422 && error.body.code === "VERIFICATION_PHOTOS_REQUIRED") {
      const details = (error.body.details ?? {}) as { required?: number; have?: number };
      return {
        ok: false,
        error: photosNeededText(details.have ?? 0, details.required ?? VERIFICATION_PHOTOS_REQUIRED),
      };
    }
    const blocked = error instanceof ApiError && error.status === 422 ? approvalBlockedMessage("store", error.body) : null;
    if (blocked) return { ok: false, error: blocked };
    return fail(error);
  }
}

/** Answers a suspended kitchen's or store's appeal without lifting the suspension.
 *  The owner sees the answer and may appeal again. */
export async function declineAppeal(kind: "kitchens" | "stores", id: string, response: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!response.trim()) return { ok: false, error: "Write an answer — the owner reads it." };
    await api(`/admin/${kind}/${encodeURIComponent(id)}/appeal/decline`, {
      method: "POST",
      scope: "admin",
      body: { response: response.trim() },
    });
    refresh();
    return { ok: true, message: "Answer sent · they can appeal again" };
  } catch (error) {
    return fail(error);
  }
}

/** Marks a kitchen or store as needing its CAC certificate before it can be approved. */
export async function setRequiresCac(kind: "kitchens" | "stores", id: string, requiresCac: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    await api(`/admin/${kind}/${encodeURIComponent(id)}/requires-cac`, {
      method: "PATCH",
      scope: "admin",
      body: { requiresCac },
    });
    refresh();
    return { ok: true, message: requiresCac ? "CAC certificate now required" : "CAC certificate no longer required" };
  } catch (error) {
    return fail(error);
  }
}

/** Moves real money. Super admin only, checked here and not by the button. */
export async function payOut(kind: "kitchens" | "riders", id: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const result = await api<Schemas["KitchenPayoutResultResponseDto"]>(
      `/admin/${kind}/${id}/payout`,
      { method: "POST", scope: "admin" },
    );
    refresh();
    return { ok: true, message: `${formatKobo(nairaToKobo(result.amountNaira))} sent` };
  } catch (error) {
    return fail(error);
  }
}

/** Identity documents. Signed URLs are short-lived, so they are fetched when
 *  someone clicks View and never kept. */
export async function riderDocumentUrl(
  id: string,
  which: "license" | "id" | "vehicleReg",
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const urls = await api<Schemas["RiderDocumentUrlsResponseDto"]>(
      `/admin/riders/${id}/documents`,
      { scope: "admin" },
    );
    const url = { license: urls.licenseDocUrl, id: urls.idDocUrl, vehicleReg: urls.vehicleRegDocUrl }[which];
    return url ? { ok: true, url } : { ok: false, error: "That document hasn't been uploaded." };
  } catch (error) {
    const result = fail(error);
    return { ok: false, error: result.ok ? "" : result.error };
  }
}

/** What the list does not carry: the owner's login and how many dishes there
 *  are. Fetched when a kitchen is opened. */
export async function kitchenDetail(id: string): Promise<
  | {
      ok: true;
      fields: { key: string; value: string }[];
      menuItems: number;
      photos: Schemas["AdminKitchenVerificationPhotoDto"][];
      /** Whether the owner's photo and the CAC certificate are on file (the files themselves stay private). */
      hasOwnerPhoto: boolean;
      hasCacDocument: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const k = await api<Schemas["AdminKitchenDetailDto"]>(`/admin/kitchens/${id}`, {
      scope: "admin",
    });
    const owner = k.staff.find((s) => s.staffRole === "OWNER") ?? k.staff[0];
    return {
      ok: true,
      menuItems: k.stats.menuItemCount,
      hasOwnerPhoto: !!k.ownerPhotoUrl,
      hasCacDocument: !!k.cacDocumentUrl,
      // Signed URLs that expire: fetched when the kitchen is opened, never kept.
      photos: k.verificationPhotos ?? [],
      fields: owner
        ? [
            { key: "Owner", value: owner.name },
            { key: "Email", value: owner.email },
            { key: "Phone", value: owner.phone ?? "—" },
          ]
        : [],
    };
  } catch (error) {
    const result = fail(error);
    return { ok: false, error: result.ok ? "" : result.error };
  }
}

export async function storePhotos(id: string): Promise<
  | { ok: true; photos: Schemas["AdminStorePhotoDto"][] }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const store = await api<Schemas["AdminStoreDetailDto"]>(
      `/admin/stores/${encodeURIComponent(id)}`,
      { scope: "admin" },
    );
    return { ok: true, photos: store.verificationPhotos };
  } catch (error) {
    const result = fail(error);
    return { ok: false, error: result.ok ? "" : result.error };
  }
}
