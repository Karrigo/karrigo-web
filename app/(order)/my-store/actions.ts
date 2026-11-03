"use server";

import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api/client";
import { dishSchema, appealSchema, noticeSchema, orderStatusSchema, sectionSchema } from "@/lib/kitchen/schema";
import type { OrderStatus } from "@/lib/kitchen/types";
import { firstIssue } from "@/lib/order/schema";
import { STORE_APPLICATION, STORE_CONSOLE } from "@/lib/store/data";
import { storeDetailsSchema } from "@/lib/store/schema";

/**
 * Running an approved store: the door, the catalog, the orders. Every call
 * carries the partner's own token, and karrigo-be decides what that token
 * may touch — a store can only ever reach its own products and orders, and
 * only an owner can change the catalog or settings (CLAUDE.md rule 3).
 */

type Failure = { ok: false; error: string };
type Done = { ok: true } | Failure;

const OWNER_ONLY = "Only the store's owner can change this. Ask them to log in.";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2.5 * 1024 * 1024;

function failure(error: unknown, messages: Partial<Record<number, string>> = {}): Failure {
  if (error instanceof ApiError) {
    return { ok: false, error: messages[error.status] ?? (error.status === 403 ? OWNER_ONLY : error.message) };
  }
  return { ok: false, error: "That didn't go through. Try again." };
}

/** The console shares its store with the application page, so both go. */
function changed() {
  revalidatePath(STORE_CONSOLE, "layout");
  revalidatePath(STORE_APPLICATION);
}

const product = (id: string) => `/store-console/catalog/products/${encodeURIComponent(id)}`;
const section = (id: string) => `/store-console/catalog/sections/${encodeURIComponent(id)}`;

/* ------------------------------------------------------------------ door */

export async function setStoreOpen(isOpen: boolean): Promise<Done> {
  try {
    await api("/store-console/store", { method: "PATCH", scope: "store", body: { isOpen } });
    changed();
    return { ok: true };
  } catch (error) {
    // The backend refuses to open a store that is not approved or has no
    // location or rider fee yet; its message says which.
    return failure(error);
  }
}

export async function saveStoreNotice(input: string): Promise<Done> {
  const notice = noticeSchema.safeParse(input);
  if (!notice.success) return { ok: false, error: firstIssue(notice.error) };
  try {
    await api("/store-console/store", { method: "PATCH", scope: "store", body: { noticeText: notice.data } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveStoreDetails(input: { name: string; riderBaseFeeNaira: number }): Promise<Done> {
  const details = storeDetailsSchema.safeParse(input);
  if (!details.success) return { ok: false, error: firstIssue(details.error) };
  try {
    await api("/store-console/store", { method: "PATCH", scope: "store", body: details.data });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------------------------------------- catalog */

export async function addStoreSection(input: { label: string; note: string }): Promise<Done> {
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await api("/store-console/catalog/sections", {
      method: "POST",
      scope: "store",
      body: { label: parsed.data.label, ...(parsed.data.note ? { note: parsed.data.note } : {}) },
    });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error, { 409: "Set your store's location first — then you can add sections." });
  }
}

export async function saveStoreSection(id: string, input: { label: string; note: string }): Promise<Done> {
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await api(section(id), { method: "PATCH", scope: "store", body: { label: parsed.data.label, note: parsed.data.note } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeStoreSection(id: string): Promise<Done> {
  try {
    await api(section(id), { method: "DELETE", scope: "store" });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error, { 409: "Move or remove the products in this section first — then it can go." });
  }
}

type ProductInput = { sectionId: string; name: string; description: string; priceNaira: number; unit: string };

/** Returns the new product's id, so its photo can be attached straight after. */
export async function addStoreProduct(input: ProductInput): Promise<Failure | { ok: true; id: string }> {
  const parsed = dishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { description, unit, ...rest } = parsed.data;
  try {
    const created = await api<{ id: string }>("/store-console/catalog/products", {
      method: "POST",
      scope: "store",
      body: { ...rest, ...(description ? { description } : {}), ...(unit ? { unit } : {}) },
    });
    changed();
    return { ok: true, id: created.id };
  } catch (error) {
    return failure(error);
  }
}

export async function saveStoreProduct(id: string, input: ProductInput): Promise<Done> {
  const parsed = dishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await api(product(id), { method: "PATCH", scope: "store", body: parsed.data });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setStoreProductSoldOut(id: string, isSoldOut: boolean): Promise<Done> {
  try {
    await api(product(id), { method: "PATCH", scope: "store", body: { isSoldOut } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeStoreProduct(id: string): Promise<Done> {
  try {
    await api(product(id), { method: "DELETE", scope: "store" });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function uploadStoreProductPhoto(form: FormData): Promise<Done> {
  const id = String(form.get("id") ?? "");
  const file = form.get("file");
  if (!id) return { ok: false, error: "Unknown product." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG or PNG photo." };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "That photo is too large. Try a smaller one." };
  try {
    const body = new FormData();
    body.set("file", file, file.name || "product.jpg");
    await api(`${product(id)}/image`, { method: "POST", scope: "store", body });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** One appeal per admin flag, against a product Karrigo has hidden. */
export async function appealStoreProductFlag(productId: string, message: string): Promise<Done> {
  const text = appealSchema.safeParse(message);
  if (!text.success) return { ok: false, error: firstIssue(text.error) };
  try {
    await api(`${product(productId)}/appeal`, { method: "POST", scope: "store", body: { message: text.data } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error, { 409: "This product has no flag to appeal, or you've already appealed it." });
  }
}

/* ---------------------------------------------------------------- orders */

export async function setStoreOrderStatus(
  id: string,
  input: OrderStatus,
  unavailableItemIds: string[] = [],
): Promise<Done> {
  const status = orderStatusSchema.safeParse(input);
  if (!status.success) return { ok: false, error: "That isn't a step an order can take." };
  try {
    await api(`/store-console/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      scope: "store",
      body: {
        status: status.data,
        ...(status.data === "ACCEPTED" && unavailableItemIds.length ? { unavailableItemIds } : {}),
      },
    });
    changed();
    return { ok: true };
  } catch (error) {
    // The order moved on while this screen showed its old state, no rider
    // has taken it yet, or the customer hasn't paid. Show the current truth.
    changed();
    if (error instanceof ApiError && error.status === 409 && error.body.code === "AWAITING_PAYMENT") {
      return { ok: false, error: String(error.body.message ?? "Waiting for the customer to pay.") };
    }
    return failure(error, {
      409:
        status.data === "PICKED_UP"
          ? "No rider has taken this order yet. Hand it over once a rider arrives for it."
          : "This order has already moved on. The list has been updated.",
      404: "We can't find that order any more. The list has been updated.",
    });
  }
}
