"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { SCOPES } from "@/lib/api/scopes";
import { clearTokens, readRefreshToken, storeTokens } from "@/lib/api/session";
import { registrationFailureMessage, registrationRequest } from "@/lib/partners/register-side";
import type { DocumentKind } from "@/lib/partners/types";
import { e164 } from "@/lib/phone";

/**
 * Applying to cook or ride for Karrigo. Both end in the same place — a
 * profile waiting for ops to approve it. The backend does the real checking
 * (it resolves the bank account with Paystack, it gates dishes on a location);
 * this layer turns its answers into sentences an applicant can act on.
 */

type Failure = { ok: false; error: string; /** Seconds until a rate-limited request may be repeated. */ retryAfter?: number };
type Done<T = object> = ({ ok: true } & T) | Failure;

function failure(error: unknown): Failure {
  if (error instanceof ApiError && error.status === 409 && error.body.code === "DOCUMENTS_LOCKED") {
    return {
      ok: false,
      error: "You're approved, so your documents and guarantor are locked. Contact Karrigo if something needs changing.",
    };
  }
  if (error instanceof ApiError) return { ok: false, error: error.message };
  return { ok: false, error: "That didn't go through. Try again." };
}

const KITCHEN_PAGE = "/partners/kitchen";
const STORE_PAGE = "/partners/store";
const RIDER_PAGE = "/partners/rider";

/** What the browser is allowed to send as a photo. Checked here as well as
 *  in the form: the form is a courtesy, this is the rule. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2.5 * 1024 * 1024;
const VERIFICATION_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

function photoFrom(form: FormData, maxBytes = PHOTO_MAX_BYTES): File | Failure {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP photo." };
  if (file.size > maxBytes) return { ok: false, error: "That photo is too large. Try a smaller one." };
  return file;
}

/* --------------------------------------------------------------- kitchen */

/** The two onboardings (kitchen and store) are one sign-up underneath: the
 *  same codes, the same checks, the same login. Only the business details and
 *  the endpoint differ. */
type Side = "kitchen" | "store";

function otpFailure(error: unknown, taken: string): Failure {
  if (error instanceof ApiError && error.status === 409) return { ok: false, error: taken };
  if (error instanceof ApiError && error.status === 429) {
    const retryAfter = typeof error.body.retryAfterSeconds === "number" ? error.body.retryAfterSeconds : undefined;
    return {
      ok: false,
      error: retryAfter ? `Too many codes requested. Try again in ${waitText(retryAfter)}.` : error.message,
      retryAfter,
    };
  }
  return failure(error);
}

/** Email a code, to prove the address is theirs. Phones are saved as typed (WhatsApp codes can't be sent yet). */
export async function requestPartnerEmailOtp(email: string): Promise<Done<{ resendCooldownSeconds: number }>> {
  try {
    const result = await api<Schemas["RequestOtpResponseDto"]>("/kitchen-auth/email-otp/request", {
      method: "POST",
      body: { email: email.trim().toLowerCase() },
    });
    return { ok: true, resendCooldownSeconds: result.resendCooldownSeconds };
  } catch (error) {
    return otpFailure(error, "That email already has a Karrigo partner account. Log in instead.");
  }
}

function waitText(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 5400) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}

type PartnerFields = {
  name: string;
  email: string;
  password: string;
  phone: string;
  /** Older forms sent a phone code; the server ignores it. */
  otpCode?: string;
  emailOtpCode: string;
  areaId: string;
};

/** What the backend's sign-up answers mean to the person filling the form. */
function applyFailure(error: unknown, side: Side): Failure {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      const left = error.body.attemptsRemaining;
      return {
        ok: false,
        error:
          typeof left === "number"
            ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
            : "That code isn't right.",
      };
    }
    if (error.status === 400 && /expired/i.test(error.message)) {
      return { ok: false, error: "That code expired. Request a new one." };
    }
    if (error.status === 409) {
      return {
        ok: false,
        error:
          error.message ||
          `That email or phone already has a Karrigo partner account. Log in, then register your business as a ${side}.`,
      };
    }
    if (error.status === 422 && error.body.code === "AREA_NOT_FOUND") {
      return { ok: false, error: "That area isn't available any more. Reload the page and pick again." };
    }
  }
  return failure(error);
}

function partnerBody(input: PartnerFields) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    phone: e164(input.phone),
    emailOtpCode: input.emailOtpCode,
    areaId: input.areaId,
  };
}

export async function applyKitchen(input: PartnerFields & { kitchenName: string; cuisine: string }): Promise<Done> {
  try {
    const result = await api<Schemas["RegisterKitchenResponseDto"]>("/kitchen-auth/register", {
      method: "POST",
      body: {
        ...partnerBody(input),
        kitchenName: input.kitchenName.trim(),
        ...(input.cuisine.trim() ? { cuisine: input.cuisine.trim() } : {}),
      },
    });
    await storeTokens("kitchen", result);
    return { ok: true };
  } catch (error) {
    return applyFailure(error, "kitchen");
  }
}

/** Store sign-up. It signs the owner in to the store only: a kitchen session
 *  is a separate, explicit sign-in. */
export async function applyStore(input: PartnerFields & { storeName: string }): Promise<Done> {
  try {
    const result = await api<{ accessToken: string; refreshToken: string }>("/store-auth/register", {
      method: "POST",
      body: { ...partnerBody(input), storeName: input.storeName.trim() },
    });
    await storeTokens("store", result);
    return { ok: true };
  } catch (error) {
    return applyFailure(error, "store");
  }
}

const storeRegistrationSchema = z.object({
  storeName: z.string().trim().min(2, "What is your store called?"),
  areaId: z.string().min(1, "Pick the area your store is in."),
});

const kitchenRegistrationSchema = z.object({
  kitchenName: z.string().trim().min(2, "What is your kitchen called?"),
  areaId: z.string().min(1, "Pick the area your kitchen is in."),
  cuisine: z.string().optional(),
});

function inputFailure(result: z.ZodSafeParseError<unknown>): Failure {
  return { ok: false, error: result.error.issues[0]?.message ?? "Check what you entered and try again." };
}

/** The session to add a side with: the one the owner is signed in with (the
 *  backend accepts either token), preferring the side they are on. */
async function heldPartnerScope(preferred: "kitchen" | "store"): Promise<"kitchen" | "store"> {
  const jar = await cookies();
  if (jar.get(SCOPES[preferred].access)?.value) return preferred;
  return preferred === "kitchen" ? "store" : "kitchen";
}

/** Add a store to the business behind the current partner session. */
export async function registerStoreForBusiness(input: { storeName: string; areaId: string }): Promise<Done> {
  const parsed = storeRegistrationSchema.safeParse(input);
  if (!parsed.success) return inputFailure(parsed);
  const request = registrationRequest("store", parsed.data);

  try {
    await api(request.path, { method: "POST", scope: await heldPartnerScope("kitchen"), body: request.body });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    const message = registrationFailureMessage(error, "store");
    return message ? { ok: false, error: message } : failure(error);
  }
}

/** Add a kitchen to the business behind the current partner session. */
export async function registerKitchenForBusiness(input: {
  kitchenName: string;
  areaId: string;
  cuisine?: string;
}): Promise<Done> {
  const parsed = kitchenRegistrationSchema.safeParse(input);
  if (!parsed.success) return inputFailure(parsed);
  const request = registrationRequest("kitchen", parsed.data);

  try {
    await api(request.path, { method: "POST", scope: await heldPartnerScope("store"), body: request.body });
    revalidatePath(KITCHEN_PAGE);
    return { ok: true };
  } catch (error) {
    const message = registrationFailureMessage(error, "kitchen");
    return message ? { ok: false, error: message } : failure(error);
  }
}

export async function kitchenLogIn(email: string, password: string): Promise<Done> {
  try {
    const tokens = await api<Schemas["TokenPairResponseDto"]>("/kitchen-auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    await storeTokens("kitchen", tokens);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, error: "That email and password don't match. Check both and try again." };
    }
    return failure(error);
  }
}

export async function kitchenLogOut(): Promise<void> {
  const refreshToken = await readRefreshToken("kitchen");
  if (refreshToken) {
    await api("/kitchen-auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
  }
  await clearTokens("kitchen");
}

export async function storeLogIn(email: string, password: string): Promise<Done> {
  try {
    const tokens = await api<Schemas["TokenPairResponseDto"]>("/store-auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    await storeTokens("store", tokens);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, error: "That email and password don't match. Check both and try again." };
    }
    return failure(error);
  }
}

export async function storeLogOut(): Promise<void> {
  const refreshToken = await readRefreshToken("store");
  if (refreshToken) {
    await api("/store-auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
  }
  await clearTokens("store");
}

/** Ends every partner session this browser holds, kitchen and store. */
export async function partnerLogOut(): Promise<void> {
  await Promise.all([kitchenLogOut(), storeLogOut()]);
}

export type Place = { label: string; lat: number; lng: number };

async function searchPartnerPlaces(path: string, scope: "kitchen" | "store", query: string): Promise<Done<{ places: Place[] }>> {
  const q = query.trim();
  if (q.length < 3) return { ok: true, places: [] };
  try {
    const places = await api<Schemas["GeocodeResultResponseDto"][]>(path, {
      scope,
      // Bias the search to the city: "Wadata market" means the one in Makurdi.
      query: { query: /makurdi/i.test(q) ? q : `${q}, Makurdi` },
    });
    return { ok: true, places: places.slice(0, 5) };
  } catch (error) {
    return failure(error);
  }
}

export async function searchPlaces(query: string): Promise<Done<{ places: Place[] }>> {
  return searchPartnerPlaces("/kitchen-console/geocode", "kitchen", query);
}

export async function searchStorePlaces(query: string): Promise<Done<{ places: Place[] }>> {
  return searchPartnerPlaces("/store-console/geocode", "store", query);
}

/** Where the kitchen is. The point is what a customer's distance and the
 *  rider's pickup run from; the landmark is what a person reads. */
export async function saveKitchenLocation(input: {
  lat: number;
  lng: number;
  area: string;
  landmarkNote: string;
}): Promise<Done> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "Pick your kitchen's spot first." };
  }
  if (!input.area) return { ok: false, error: "Pick the area your kitchen is in." };
  try {
    await api("/kitchen-console/kitchen", {
      method: "PATCH",
      scope: "kitchen",
      body: {
        lat: input.lat,
        lng: input.lng,
        area: input.area,
        ...(input.landmarkNote.trim() ? { landmarkNote: input.landmarkNote.trim() } : {}),
      },
    });
    revalidatePath(KITCHEN_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

async function saveBank(
  path: string,
  scope: "kitchen" | "store" | "customer",
  page: string,
  bankCode: string,
  accountNumber: string,
): Promise<Done<{ accountName: string | null }>> {
  if (!bankCode) return { ok: false, error: "Pick your bank." };
  if (!/^\d{10}$/.test(accountNumber)) return { ok: false, error: "A bank account number is 10 digits." };
  try {
    const result = await api<{ payoutAccountName?: string | null }>(path, {
      method: "PATCH",
      scope,
      body: { bankCode, accountNumber },
    });
    revalidatePath(page);
    return { ok: true, accountName: result.payoutAccountName ?? null };
  } catch (error) {
    return failure(error);
  }
}

export async function saveKitchenBank(bankCode: string, accountNumber: string) {
  return saveBank("/kitchen-console/kitchen/payout-account", "kitchen", KITCHEN_PAGE, bankCode, accountNumber);
}

export async function saveStoreLocation(input: {
  lat: number;
  lng: number;
  area?: string;
  landmarkNote?: string;
}): Promise<Done> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "Pick your store's spot first." };
  }
  try {
    await api("/store-console/store", {
      method: "PATCH",
      scope: "store",
      body: {
        lat: input.lat,
        lng: input.lng,
        ...(input.area?.trim() ? { area: input.area.trim() } : {}),
        ...(input.landmarkNote?.trim() ? { landmarkNote: input.landmarkNote.trim() } : {}),
      },
    });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

const storeFeeSchema = z.number().int().min(500).max(20_000);

export async function saveStoreFee(riderBaseFeeNaira: number): Promise<Done> {
  const fee = storeFeeSchema.safeParse(riderBaseFeeNaira);
  if (!fee.success) return { ok: false, error: "Set the rider fee between ₦500 and ₦20,000." };
  try {
    await api("/store-console/store", {
      method: "PATCH",
      scope: "store",
      body: { riderBaseFeeNaira: fee.data },
    });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveStoreBank(
  bankCode: string,
  accountNumber: string,
): Promise<Done<{ accountName: string | null }>> {
  if (!bankCode) return { ok: false, error: "Pick your bank." };
  if (!/^\d{10}$/.test(accountNumber)) return { ok: false, error: "A bank account number is 10 digits." };
  try {
    const resolved = await api<{ accountName?: string | null }>("/store-console/store/payout-account/resolve", {
      method: "POST",
      scope: "store",
      body: { bankCode, accountNumber },
    });
    const saved = await api<{ payoutAccountName?: string | null }>("/store-console/store/payout-account", {
      method: "PATCH",
      scope: "store",
      body: { bankCode, accountNumber },
    });
    revalidatePath(STORE_PAGE);
    return { ok: true, accountName: resolved.accountName ?? saved.payoutAccountName ?? null };
  } catch (error) {
    return failure(error);
  }
}

export async function uploadStorePhoto(form: FormData): Promise<Done> {
  const file = photoFrom(form, VERIFICATION_PHOTO_MAX_BYTES);
  if (!(file instanceof File)) return file;
  try {
    const body = new FormData();
    body.set("file", file, file.name || "store.jpg");
    await api("/store-console/store/photos", { method: "POST", scope: "store", body });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      revalidatePath(STORE_PAGE);
      return { ok: false, error: "You already have 6 store photos." };
    }
    return failure(error);
  }
}

export async function deleteStorePhoto(id: string): Promise<Done> {
  try {
    await api(`/store-console/store/photos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      scope: "store",
    });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      revalidatePath(STORE_PAGE);
      return { ok: false, error: "That photo is already gone. The list has been updated." };
    }
    return failure(error);
  }
}

/** Ask support to unlock the approved photo set: the reason goes on a ticket
 * and an approval re-opens edits for 7 days. Owner only. */
export async function requestStorePhotoUpdate(reason: string): Promise<Done> {
  const text = reason.trim();
  if (text.length < 10) return { ok: false, error: "Please tell us why you need to update your photos." };
  if (text.length > 1000) return { ok: false, error: "Keep it under 1000 characters." };
  try {
    await api("/store-console/store/photos/update-request", {
      method: "POST",
      scope: "store",
      body: { reason: text },
    });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { ok: false, error: "Only the business owner can request a photo update. Ask them to log in." };
    }
    if (error instanceof ApiError && error.status === 409) {
      revalidatePath(STORE_PAGE);
      return { ok: false, error: "You already have a photo update request pending review." };
    }
    return failure(error);
  }
}

export async function appealStore(message: string): Promise<Done> {
  const text = message.trim();
  if (!text) return { ok: false, error: "Tell us what has changed." };
  if (text.length > 500) return { ok: false, error: "Keep it under 500 characters." };
  try {
    await api("/store-console/store/appeal", {
      method: "POST",
      scope: "store",
      body: { message: text },
    });
    revalidatePath(STORE_PAGE);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { ok: false, error: "Only the business owner can send a store appeal. Ask them to log in." };
    }
    return failure(error);
  }
}

export async function uploadKitchenPhoto(form: FormData): Promise<Done> {
  const file = photoFrom(form);
  if (!(file instanceof File)) return file;
  try {
    const body = new FormData();
    body.set("file", file, file.name || "kitchen.jpg");
    await api("/kitchen-console/kitchen/hero-image", { method: "POST", scope: "kitchen", body });
    revalidatePath(KITCHEN_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------------------- owner photo, storefront, CAC */

/** One private document or image for a side's owner. The backend replaces any earlier one. */
async function uploadOwnerFile(
  path: string,
  scope: "kitchen" | "store",
  page: string,
  form: FormData,
  fallbackName: string,
  maxBytes?: number,
): Promise<Done> {
  const file = photoFrom(form, maxBytes);
  if (!(file instanceof File)) return file;
  try {
    const body = new FormData();
    body.set("file", file, file.name || fallbackName);
    await api(path, { method: "POST", scope, body });
    revalidatePath(page);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The owner's photo, which an admin needs on file before approving. */
export async function uploadStoreOwnerPhoto(form: FormData): Promise<Done> {
  return uploadOwnerFile("/store-console/store/owner-photo", "store", STORE_PAGE, form, "owner.jpg", VERIFICATION_PHOTO_MAX_BYTES);
}

export async function uploadKitchenOwnerPhoto(form: FormData): Promise<Done> {
  return uploadOwnerFile("/kitchen-console/kitchen/owner-photo", "kitchen", KITCHEN_PAGE, form, "owner.jpg", VERIFICATION_PHOTO_MAX_BYTES);
}

/** The storefront image customers see on the store's card and page. */
export async function uploadStoreHero(form: FormData): Promise<Done> {
  return uploadOwnerFile("/store-console/store/hero-image", "store", STORE_PAGE, form, "storefront.jpg");
}

/** The CAC certificate, needed only when ops has marked the business as registered. */
export async function uploadStoreCac(form: FormData): Promise<Done> {
  return uploadOwnerFile("/store-console/store/cac", "store", STORE_PAGE, form, "cac.jpg", VERIFICATION_PHOTO_MAX_BYTES);
}

export async function uploadKitchenCac(form: FormData): Promise<Done> {
  return uploadOwnerFile("/kitchen-console/kitchen/cac", "kitchen", KITCHEN_PAGE, form, "cac.jpg", VERIFICATION_PHOTO_MAX_BYTES);
}

/** One dish. The first one also creates the section it sits in, so a new
 *  kitchen never has to learn what a "section" is before it can list food. */
export async function addDish(input: { name: string; description: string; priceNaira: number }): Promise<Done> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Give the dish a name." };
  if (!Number.isFinite(input.priceNaira) || input.priceNaira <= 0) return { ok: false, error: "Add a price." };

  try {
    const kitchen = await api<Schemas["KitchenWithMenuResponseDto"]>("/kitchen-console/kitchen", { scope: "kitchen" });
    // The backend refuses dishes until it knows where the kitchen is. Say so
    // here rather than passing on whatever error that produces.
    if (kitchen.lat == null || kitchen.lng == null) {
      return { ok: false, error: "Set your kitchen's location first — then you can add dishes." };
    }

    const sectionId =
      kitchen.sections[0]?.id ??
      (
        await api<Schemas["MenuSectionResponseDto"]>("/kitchen-console/menu/sections", {
          method: "POST",
          scope: "kitchen",
          body: { label: "Menu" },
        })
      ).id;

    await api("/kitchen-console/menu/items", {
      method: "POST",
      scope: "kitchen",
      body: {
        sectionId,
        name,
        priceNaira: input.priceNaira,
        ...(input.description.trim() ? { description: input.description.trim() } : {}),
      },
    });
    revalidatePath(KITCHEN_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDish(id: string): Promise<Done> {
  try {
    await api(`/kitchen-console/menu/items/${encodeURIComponent(id)}`, { method: "DELETE", scope: "kitchen" });
    revalidatePath(KITCHEN_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** A suspended kitchen's owner gets one appeal per ban. The kitchen stays
 *  suspended until ops lifts it; there is no going back to the queue. */
export async function appealKitchen(message: string): Promise<Done> {
  const text = message.trim();
  if (!text) return { ok: false, error: "Tell us what has changed." };
  if (text.length > 500) return { ok: false, error: "Keep it under 500 characters." };
  try {
    await api("/kitchen-console/kitchen/appeal", { method: "POST", scope: "kitchen", body: { message: text } });
    revalidatePath(KITCHEN_PAGE);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { ok: false, error: "Only the kitchen's owner can send an appeal. Ask them to log in." };
    }
    return failure(error);
  }
}

/* ----------------------------------------------------------------- rider */

/**
 * Becoming a rider changes the account's role, and the access token in hand
 * was issued for a customer. Trade it for a fresh one straight away, or the
 * very next step — uploading a licence — is refused as "not a rider".
 */
async function renewCustomerSession(): Promise<void> {
  const refreshToken = await readRefreshToken("customer");
  if (!refreshToken) return;
  try {
    const tokens = await api<Schemas["TokenPairResponseDto"]>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
    await storeTokens("customer", tokens);
  } catch {
    // Keep the session they have; proxy.ts renews it within 15 minutes.
  }
}

export async function saveVehicle(input: { vehicleType: string; plateNumber: string }): Promise<Done> {
  const body = {
    vehicleType: input.vehicleType.trim(),
    plateNumber: input.plateNumber.trim().toUpperCase(),
  };
  if (!body.vehicleType) return { ok: false, error: "Pick what you ride." };
  if (body.vehicleType !== "Bicycle" && body.plateNumber.length < 4) {
    return { ok: false, error: "Add your plate number." };
  }

  try {
    try {
      await api("/riders/onboard", { method: "POST", scope: "customer", body });
      await renewCustomerSession();
    } catch (error) {
      // Already a rider — this is an edit, not a first application.
      if (!(error instanceof ApiError && error.status === 409)) throw error;
      await api("/riders/me/vehicle", { method: "PATCH", scope: "customer", body });
    }
    revalidatePath(RIDER_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

const DOCUMENT_KINDS: DocumentKind[] = ["license", "id", "vehicleReg"];

export async function uploadRiderDocument(form: FormData): Promise<Done> {
  const kind = String(form.get("kind"));
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) return { ok: false, error: "Unknown document." };
  const file = photoFrom(form);
  if (!(file instanceof File)) return file;

  try {
    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file, file.name || `${kind}.jpg`);
    await api("/riders/me/documents", { method: "POST", scope: "customer", body });
    revalidatePath(RIDER_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveGuarantor(input: { name: string; phone: string; address: string }): Promise<Done> {
  const phone = e164(input.phone);
  if (input.name.trim().length < 2) return { ok: false, error: "Add your guarantor's full name." };
  if (!/^\+234\d{10}$/.test(phone)) return { ok: false, error: "Add your guarantor's phone number, like 0803 123 4567." };
  if (input.address.trim().length < 5) return { ok: false, error: "Add where your guarantor lives." };

  try {
    await api("/riders/me/guarantor", {
      method: "PATCH",
      scope: "customer",
      body: { guarantorName: input.name.trim(), guarantorPhone: phone, guarantorAddress: input.address.trim() },
    });
    revalidatePath(RIDER_PAGE);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Send a rejected application back to ops without uploading anything — for
 * when the fix was the guarantor, or nothing needed a new photo. karrigo-be
 * refuses it unless all three documents and the guarantor are on file.
 */
export async function requestRiderReview(): Promise<Done> {
  try {
    await api("/riders/me/request-review", { method: "POST", scope: "customer" });
    revalidatePath(RIDER_PAGE);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      revalidatePath(RIDER_PAGE);
      return { ok: false, error: "Your application is already with our team." };
    }
    return failure(error);
  }
}

export async function saveRiderBank(bankCode: string, accountNumber: string) {
  return saveBank("/riders/me/payout-account", "customer", RIDER_PAGE, bankCode, accountNumber);
}
