"use server";

import { revalidatePath } from "next/cache";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { APPLICATION, CONSOLE } from "@/lib/kitchen/data";
import {
  appealSchema,
  dishSchema,
  hoursSchema,
  noticeSchema,
  orderStatusSchema,
  passwordSchema,
  profileSchema,
  riderFeeSchema,
  sectionSchema,
  sidesSchema,
  ticketSchema,
} from "@/lib/kitchen/schema";
import type { DayHours, OrderStatus } from "@/lib/kitchen/types";
import { firstIssue } from "@/lib/order/schema";
import { e164 } from "@/lib/phone";

/**
 * Running a live kitchen: the door, the menu, the orders, the hours. Every
 * call carries the kitchen's own token, and karrigo-be decides what that
 * token may touch — a kitchen can only ever reach its own dishes and orders,
 * and only an owner can change settings (CLAUDE.md rule 3).
 */

type Failure = { ok: false; error: string };
type Done = { ok: true } | Failure;

const OWNER_ONLY = "Only the kitchen's owner can change this. Ask them to log in.";

function failure(error: unknown, messages: Partial<Record<number, string>> = {}): Failure {
  if (error instanceof ApiError) {
    return { ok: false, error: messages[error.status] ?? (error.status === 403 ? OWNER_ONLY : error.message) };
  }
  return { ok: false, error: "That didn't go through. Try again." };
}

/** The console shares its kitchen with the application page, so both go. */
function changed() {
  revalidatePath(CONSOLE, "layout");
  revalidatePath(APPLICATION);
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2.5 * 1024 * 1024;
/** Verification photos are checked by people, so the backend allows more. */
const VERIFICATION_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

type KitchenMissing = Schemas["KitchenResponseDto"]["missing"][number];

const MISSING_TEXT: Record<KitchenMissing, string> = {
  LOCATION: "your kitchen's location",
  RIDER_FEE: "the rider base delivery fee",
};

/** "your location and the rider fee" from the backend's list of what's missing. */
function missingText(details: unknown): string {
  const parts = (Array.isArray(details) ? details : [])
    .map((d) => MISSING_TEXT[d as KitchenMissing])
    .filter((t): t is string => !!t);
  if (parts.length === 0) return "your kitchen's setup";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const item = (id: string) => `/kitchen-console/menu/items/${encodeURIComponent(id)}`;
const section = (id: string) => `/kitchen-console/menu/sections/${encodeURIComponent(id)}`;

/* ------------------------------------------------------------------ door */

export async function setOpen(isOpen: boolean): Promise<Done> {
  try {
    await api("/kitchen-console/kitchen", { method: "PATCH", scope: "kitchen", body: { isOpen } });
    changed();
    return { ok: true };
  } catch (error) {
    // Opening is refused until the kitchen has a location and a rider fee.
    // Say which is missing; the setup page is where to fix it.
    if (error instanceof ApiError && error.status === 422 && error.body.code === "KITCHEN_NOT_READY") {
      changed();
      return { ok: false, error: `You can't open yet. Set ${missingText(error.body.details)} first.` };
    }
    return failure(error);
  }
}

export async function saveNotice(input: string): Promise<Done> {
  const notice = noticeSchema.safeParse(input);
  if (!notice.success) return { ok: false, error: firstIssue(notice.error) };
  try {
    await api("/kitchen-console/kitchen", { method: "PATCH", scope: "kitchen", body: { noticeText: notice.data } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveProfile(input: { name: string; cuisine: string; riderBaseFeeNaira: number }): Promise<Done> {
  const profile = profileSchema.safeParse(input);
  if (!profile.success) return { ok: false, error: firstIssue(profile.error) };
  try {
    await api("/kitchen-console/kitchen", { method: "PATCH", scope: "kitchen", body: profile.data });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Just the rider base fee, for the setup page where the other details are
 *  not on screen. */
export async function saveRiderFee(riderBaseFeeNaira: number): Promise<Done> {
  const parsed = riderFeeSchema.safeParse({ riderBaseFeeNaira });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await api("/kitchen-console/kitchen", { method: "PATCH", scope: "kitchen", body: parsed.data });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveHours(input: DayHours[]): Promise<Done> {
  const days = hoursSchema.safeParse(input);
  if (!days.success) return { ok: false, error: firstIssue(days.error) };
  try {
    await api("/kitchen-console/kitchen/hours", {
      method: "PATCH",
      scope: "kitchen",
      body: {
        days: days.data.map((d) => ({
          dayOfWeek: d.day,
          isClosed: d.closed,
          ...(d.closed ? {} : { openTime: d.open, closeTime: d.close }),
        })),
      },
    });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ menu */

export async function addSection(input: { label: string; note: string; type?: "FOOD" | "GROCERY" }): Promise<Done> {
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await api("/kitchen-console/menu/sections", {
      method: "POST",
      scope: "kitchen",
      body: {
        label: parsed.data.label,
        ...(parsed.data.note ? { note: parsed.data.note } : {}),
        ...(parsed.data.type ? { type: parsed.data.type } : {}),
      },
    });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSection(id: string, input: { label: string; note: string }): Promise<Done> {
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    // A section's side is fixed when it is created, so it is never sent here.
    const { label, note } = parsed.data;
    await api(section(id), { method: "PATCH", scope: "kitchen", body: { label, note } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeSection(id: string): Promise<Done> {
  try {
    await api(section(id), { method: "DELETE", scope: "kitchen" });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error, { 409: "Move or remove the dishes in this section first — then it can go." });
  }
}

type DishInput = { sectionId: string; name: string; description: string; priceNaira: number; unit: string };

export async function addDish(input: DishInput): Promise<Done> {
  const dish = dishSchema.safeParse(input);
  if (!dish.success) return { ok: false, error: firstIssue(dish.error) };
  const { description, unit, ...rest } = dish.data;
  try {
    await api("/kitchen-console/menu/items", {
      method: "POST",
      scope: "kitchen",
      body: { ...rest, ...(description ? { description } : {}), ...(unit ? { unit } : {}) },
    });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveDish(id: string, input: DishInput): Promise<Done> {
  const dish = dishSchema.safeParse(input);
  if (!dish.success) return { ok: false, error: firstIssue(dish.error) };
  try {
    await api(item(id), { method: "PATCH", scope: "kitchen", body: dish.data });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setSoldOut(id: string, isSoldOut: boolean): Promise<Done> {
  try {
    await api(item(id), { method: "PATCH", scope: "kitchen", body: { isSoldOut } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDish(id: string): Promise<Done> {
  try {
    await api(item(id), { method: "DELETE", scope: "kitchen" });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function uploadDishPhoto(form: FormData): Promise<Done> {
  const id = String(form.get("id") ?? "");
  const file = form.get("file");
  if (!id) return { ok: false, error: "Unknown dish." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG or PNG photo." };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "That photo is too large. Try a smaller one." };
  try {
    const body = new FormData();
    body.set("file", file, file.name || "dish.jpg");
    await api(`${item(id)}/image`, { method: "POST", scope: "kitchen", body });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------- verification photos */

/** One of the 6 photos ops checks before approving. Owner only; the backend
 *  enforces the type, size and the limit of 6, and this says so kindly. */
export async function uploadVerificationPhoto(form: FormData): Promise<Done> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP photo." };
  if (file.size > VERIFICATION_PHOTO_MAX_BYTES) return { ok: false, error: "That photo is too large (8 MB at most). Try a smaller one." };
  try {
    const body = new FormData();
    body.set("file", file, file.name || "kitchen.jpg");
    await api("/kitchen-console/kitchen/photos", { method: "POST", scope: "kitchen", body });
    changed();
    return { ok: true };
  } catch (error) {
    // The page showing fewer than 6 was out of date; refresh it too.
    if (error instanceof ApiError && error.status === 409) changed();
    return failure(error, { 409: "You already have 6 photos." });
  }
}

export async function deleteVerificationPhoto(id: string): Promise<Done> {
  try {
    await api(`/kitchen-console/kitchen/photos/${encodeURIComponent(id)}`, { method: "DELETE", scope: "kitchen" });
    changed();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) changed();
    return failure(error, { 404: "That photo is already gone. The list has been updated." });
  }
}

/** Ask support to unlock the approved photo set: the reason goes on a ticket
 * and an approval re-opens edits for 7 days. Owner only. */
export async function requestKitchenPhotoUpdate(reason: string): Promise<Done> {
  const text = reason.trim();
  if (text.length < 10) return { ok: false, error: "Please tell us why you need to update your photos." };
  if (text.length > 1000) return { ok: false, error: "Keep it under 1000 characters." };
  try {
    await api("/kitchen-console/kitchen/photos/update-request", {
      method: "POST",
      scope: "kitchen",
      body: { reason: text },
    });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error, {
      403: "Only the business owner can request a photo update. Ask them to log in.",
      409: "You already have a photo update request pending review.",
    });
  }
}

/** One appeal per admin flag, against a product Karrigo has hidden. */
export async function appealFlag(itemId: string, message: string): Promise<Done> {
  const text = appealSchema.safeParse(message);
  if (!text.success) return { ok: false, error: firstIssue(text.error) };
  try {
    await api(`${item(itemId)}/appeal`, { method: "POST", scope: "kitchen", body: { message: text.data } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error, { 409: "This product has no flag to appeal, or you've already appealed it." });
  }
}

/** Whether the kitchen takes food orders, grocery orders, or both. */
export async function saveSides(input: { servesFood: boolean; servesGrocery: boolean }): Promise<Done> {
  const sides = sidesSchema.safeParse(input);
  if (!sides.success) return { ok: false, error: firstIssue(sides.error) };
  try {
    await api("/kitchen-console/kitchen", { method: "PATCH", scope: "kitchen", body: sides.data });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------------------------------------- orders */

export async function setOrderStatus(id: string, input: OrderStatus, unavailableItemIds: string[] = []): Promise<Done> {
  const status = orderStatusSchema.safeParse(input);
  if (!status.success) return { ok: false, error: "That isn't a step an order can take." };
  try {
    await api(`/kitchen-console/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      scope: "kitchen",
      body: {
        status: status.data,
        // Only a grocery order being accepted can leave lines out.
        ...(status.data === "ACCEPTED" && unavailableItemIds.length ? { unavailableItemIds } : {}),
      },
    });
    changed();
    return { ok: true };
  } catch (error) {
    // The order moved on while this screen was showing its old state, no
    // rider has taken it yet, or (moving to PREPARING) the customer hasn't
    // paid. Show the current truth alongside the reason.
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

/* --------------------------------------------------------- help, account */

export async function reportProblem(input: { subject: string; body: string }): Promise<Done> {
  const ticket = ticketSchema.safeParse(input);
  if (!ticket.success) return { ok: false, error: firstIssue(ticket.error) };
  try {
    await api("/kitchen-console/support-tickets", {
      method: "POST",
      scope: "kitchen",
      body: { subject: ticket.data.subject, ...(ticket.data.body ? { body: ticket.data.body } : {}) },
    });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveStaffPhone(input: string): Promise<Done> {
  const phone = e164(input);
  if (!/^\+234\d{10}$/.test(phone)) return { ok: false, error: "Enter an 11-digit phone number, like 0803 123 4567." };
  try {
    await api("/kitchen-auth/me/profile", { method: "PATCH", scope: "kitchen", body: { phone } });
    changed();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<Done> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await api("/kitchen-auth/password/change", { method: "POST", scope: "kitchen", body: parsed.data });
    return { ok: true };
  } catch (error) {
    return failure(error, { 401: "That isn't your current password. Check it and try again." });
  }
}
