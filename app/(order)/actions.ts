"use server";

import { headers } from "next/headers";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { clearTokens, readRefreshToken, storeTokens } from "@/lib/api/session";
import { nairaToKobo } from "@/lib/money";
import { cleanAddressLabel } from "@/lib/order/address";
import { e164 } from "@/lib/phone";
import { hasPartnerSession } from "@/lib/partners/data";
import { priceLines } from "@/lib/shop/catalog";
import { getCustomer } from "@/lib/shop/session";
import { basketIssue } from "@/lib/shop/limits";
import { listAreas } from "@/lib/shop/areas";
import type { Customer, PricedCart, Side, Vendor } from "@/lib/shop/types";

/**
 * Every customer mutation, as a Server Action. The backend does the real
 * checking (it re-prices from live menu prices and re-checks the delivery
 * zone); this layer turns its answers into sentences a hungry person can act
 * on, and never lets a raw error reach the screen.
 */

export type Failure = { ok: false; error: string; /** Seconds before another code can be asked for. */ retryAfter?: number };
type Done<T = object> = ({ ok: true } & T) | Failure;

function failure(error: unknown, fallback = "That didn't go through. Try again."): Failure {
  if (error instanceof ApiError) {
    const retry = error.body.retryAfterSeconds;
    return {
      ok: false,
      error: error.message,
      ...(typeof retry === "number" ? { retryAfter: retry } : {}),
    };
  }
  return { ok: false, error: fallback };
}

/* ------------------------------------------------------------------ auth */


const RIDER_MESSAGE =
  "Riders sign in on the Karrigo Partner app. The website is for customers and kitchens.";

/**
 * Riders only have the partner app (a shareholder decision), so a rider's
 * phone and password must never open a website session. The API signs them in
 * like anyone else, so after sign-in we look at the role and, for a rider,
 * revoke the session we just stored.
 */
async function refuseRider(): Promise<boolean> {
  const me = await api<{ role?: string }>("/auth/me", { scope: "customer" });
  if (me.role !== "RIDER") return false;
  await logOut();
  return true;
}

export async function logIn(phone: string, password: string): Promise<Done<{ needsOtp?: boolean }>> {
  try {
    const tokens = await api<Schemas["TokenPairResponseDto"]>("/auth/login", {
      method: "POST",
      body: { phone: e164(phone), password },
    });
    await storeTokens("customer", tokens);
    if (await refuseRider()) return { ok: false, error: RIDER_MESSAGE };
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && error.body.passwordNotSet) {
      return {
        ok: false,
        error: "This number has no password yet. Use “Forgot password” to set one.",
      };
    }
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, error: "That number and password don't match. Check both and try again." };
    }
    return failure(error);
  }
}

export async function logOut(): Promise<void> {
  const refreshToken = await readRefreshToken("customer");
  if (refreshToken) {
    await api("/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
  }
  await clearTokens("customer");
}

/** Step one of signup, and of resetting a forgotten password. */
export async function requestCode(phone: string, intent: "signup" | "reset"): Promise<Done> {
  try {
    await api("/auth/otp/request", { method: "POST", body: { phone: e164(phone), intent } });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { ok: false, error: "That number already has an account. Log in instead." };
    }
    if (error instanceof ApiError && error.status === 404) {
      return { ok: false, error: "No account with that number. Sign up instead." };
    }
    return failure(error);
  }
}

/**
 * Step two: the code proves the phone, which earns a one-shot token for
 * setting the password; that call is what signs them in. The name is saved
 * last, once there is a session to attach it to.
 */
export async function verifyAndSetPassword(input: {
  phone: string;
  code: string;
  password: string;
  name?: string;
}): Promise<Done> {
  try {
    const verified = await api<Schemas["PhoneVerifiedResponseDto"]>("/auth/otp/verify", {
      method: "POST",
      body: { phone: e164(input.phone), code: input.code },
    });
    const tokens = await api<Schemas["TokenPairResponseDto"]>("/auth/password/set", {
      method: "POST",
      body: { setupToken: verified.setupToken, password: input.password },
    });
    await storeTokens("customer", tokens);
    if (await refuseRider()) return { ok: false, error: RIDER_MESSAGE };

    if (input.name?.trim()) {
      // A name that fails to save must not undo a successful signup.
      await api("/auth/me", { method: "PATCH", scope: "customer", body: { name: input.name.trim() } }).catch(
        () => {},
      );
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, error: "That code didn't work, or it has expired. Check it or ask for a new one." };
    }
    return failure(error);
  }
}

/* ------------------------------------------------------------- gift tag */

export type GiftRecipient = { tag: string; displayName: string | null; avatarUrl: string | null };

/** Who a tag belongs to, for the "Sending to …" line. Name and avatar only. */
export async function lookupRecipient(tag: string): Promise<Done<{ recipient: GiftRecipient }>> {
  const clean = tag.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return { ok: false, error: "Tags are 3–20 letters, numbers or underscores." };
  }
  try {
    const recipient = await api<GiftRecipient>(`/users/by-tag/${encodeURIComponent(clean)}`, { scope: "customer" });
    return { ok: true, recipient };
  } catch (error) {
    return failure(error, "We couldn't find that person. Check the tag and try again.");
  }
}

export type TagSettings = { tag: string | null; allowOrdersFromOthers: boolean };

export async function getTagSettings(): Promise<TagSettings | { error: string; message?: string }> {
  try {
    const [me, settings] = await Promise.all([
      api<{ tag?: string | null }>("/auth/me", { scope: "customer" }),
      api<{ allowOrdersFromOthers: boolean }>("/users/me/settings", { scope: "customer" }),
    ]);
    return { tag: me.tag ?? null, allowOrdersFromOthers: settings.allowOrdersFromOthers };
  } catch (error) {
    // The page only says it couldn't load; the reason belongs in the server log.
    const reason = error instanceof ApiError ? `${error.status} ${error.message}` : String(error);
    console.warn("[getTagSettings] failed:", reason);
    // Tags belong to customer accounts; a rider account is refused by the API.
    if (error instanceof ApiError && error.status === 403) {
      return { error: reason, message: "Tags are only available on customer accounts, and this account is a rider account. Log in with a customer account to set one." };
    }
    return { error: reason };
  }
}

export async function saveTag(tag: string): Promise<Done<{ tag: string }>> {
  try {
    const saved = await api<{ tag: string }>("/users/me/tag", {
      method: "PUT",
      scope: "customer",
      body: { tag: tag.trim().replace(/^@+/, "") },
    });
    return { ok: true, tag: saved.tag };
  } catch (error) {
    return failure(error, "We couldn't save your tag. Try again.");
  }
}

export async function setAllowOrdersFromOthers(allow: boolean): Promise<Done> {
  try {
    await api("/users/me/settings", { method: "PATCH", scope: "customer", body: { allowOrdersFromOthers: allow } });
    return { ok: true };
  } catch (error) {
    return failure(error, "We couldn't update that. Try again.");
  }
}

/* ------------------------------------------------------------------ cart */

/** Prices the cart against the menu as it is right now. Called when a cart is
 *  opened and again at checkout. */
export async function priceCartAction(
  slug: string,
  lines: Record<string, number>,
  side: Side = "FOOD",
  vendor: Vendor = "kitchen",
): Promise<Done<{ cart: PricedCart | null }>> {
  try {
    return { ok: true, cart: await priceLines(slug, lines, side, vendor) };
  } catch (error) {
    return failure(error, "We couldn't check the menu just now. Try again.");
  }
}

/* --------------------------------------------------------------- address */

export type AddressSuggestion = { label: string; lat: number; lng: number };

/** Up to five places matching what the customer typed, biased to Makurdi.
 *  The backend allows 30 of these a minute, so the field debounces. */
export async function searchAddresses(query: string): Promise<Done<{ results: AddressSuggestion[] }>> {
  const q = query.trim();
  if (q.length < 3) return { ok: true, results: [] };
  try {
    const found = await api<Schemas["GeocodeResultResponseDto"][]>("/addresses/search", {
      scope: "customer",
      query: { query: q },
    });
    const seen = new Set<string>();
    const results = found
      .map((r) => ({ label: cleanAddressLabel(r.label), lat: r.lat, lng: r.lng }))
      .filter((r) => r.label && !seen.has(r.label) && (seen.add(r.label), true));
    return { ok: true, results };
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      return { ok: false, error: "Slow down a little — try the search again in a moment." };
    }
    return failure(error, "Address search isn't working right now. Type your landmark instead.");
  }
}

/** A readable address for the customer's current location. */
export async function addressAt(lat: number, lng: number): Promise<Done<{ address: string }>> {
  try {
    const r = await api<Schemas["ReverseGeocodeResponseDto"]>("/addresses/reverse-geocode", {
      scope: "customer",
      query: { lat, lng },
    });
    return { ok: true, address: cleanAddressLabel(r.address) };
  } catch (error) {
    return failure(error, "We couldn't name that spot. Your landmark is enough.");
  }
}

export async function validatePromo(code: string, subtotalKobo: number): Promise<Done<{ discountKobo: number; code: string }>> {
  try {
    const result = await api<{ code: string; discountNaira: number }>("/orders/promo/validate", {
      method: "POST",
      scope: "customer",
      body: { code: code.trim(), subtotalNaira: subtotalKobo / 100 },
    });
    return { ok: true, code: result.code, discountKobo: nairaToKobo(result.discountNaira) };
  } catch (error) {
    return failure(error);
  }
}

/* ----------------------------------------------------------------- order */

/** What a payment actually went through as, once Paystack confirms it.
 *  `online` covers USSD and anything else Paystack offers that we don't
 *  label by name (SYNC_WEB_CUSTOMER_AND_KITCHEN.md §2.5). */
export type PayChoice = "card" | "transfer" | "online";

export type PlaceInput = {
  kitchenSlug: string;
  /** A store is ordered from by its own product ids. Kitchen when omitted. */
  vendor?: Vendor;
  /** Which side of the place the cart is from. Food when omitted. */
  side?: Side;
  lines: Record<string, number>;
  landmark: string;
  address: string;
  area: string;
  note: string;
  email: string;
  promoCode?: string;
  /** From the browser's location, when they chose to share it. */
  coords?: { lat: number; lng: number };
  /** Sending to someone else: their tag. The server delivers to their saved address, so the address fields above are ignored. */
  recipientTag?: string;
  giftMessage?: string;
};

/** Where an address is, best answer first: what the customer shared or
 *  picked, else the first place the backend finds for what they typed. When
 *  none is found, the chosen area's centre is resolved by the backend. */
async function locate(
  given: { lat: number; lng: number } | undefined,
  text: string[],
): Promise<{ lat: number; lng: number } | undefined> {
  if (given) return given;
  for (const query of text) {
    const q = query.trim();
    if (q.length < 3) continue;
    try {
      const found = await api<Schemas["GeocodeResultResponseDto"][]>("/addresses/search", {
        scope: "customer",
        query: { query: q },
      });
      if (found[0]) return { lat: found[0].lat, lng: found[0].lng };
    } catch {
      // Search being down must not stop an order; try the next query, then let
      // the backend use the chosen area's centre.
    }
  }
  return undefined;
}

export async function placeOrder(
  input: PlaceInput,
): Promise<Done<{ orderId: string }>> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: "Log in to place your order." };
  // A kitchen or store owner can look around as a customer would, but not
  // order: the check lives here because the page's disabled button is only
  // a courtesy.
  if (await hasPartnerSession()) {
    return { ok: false, error: "You're signed in to your business. Log out of it to place an order." };
  }

  try {
    // Re-check the cart against the live menu before anything is created.
    const cart = await priceLines(input.kitchenSlug, input.lines, input.side ?? "FOOD", input.vendor ?? "kitchen");
    if (!cart) return { ok: false, error: "That place isn't taking orders right now." };
    if (!cart.kitchen.open) {
      return { ok: false, error: `${cart.kitchen.name} is closed right now${cart.kitchen.notice ? `: ${cart.kitchen.notice}` : "."}` };
    }
    if (cart.unavailable.length) {
      return {
        ok: false,
        error: `${cart.kitchen.name} has run out of ${cart.unavailable.join(", ")}. Take it out of your cart and try again.`,
      };
    }
    if (!cart.lines.length) return { ok: false, error: "Your cart is empty." };

    const issue = basketIssue({
      side: cart.side,
      name: cart.kitchen.name,
      count: cart.count,
      subtotalKobo: cart.subtotalKobo,
      maxItems: cart.kitchen.maxItems,
      minOrderKobo: cart.kitchen.minOrderKobo,
    });
    if (issue) return { ok: false, error: issue.message };

    // Every order pays through Paystack, which needs an email for the
    // receipt. Save it once so it is not asked again.
    if (!customer.email) {
      const email = input.email.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return { ok: false, error: "Add your email so Paystack can send your receipt." };
      }
      await api("/auth/me", { method: "PATCH", scope: "customer", body: { email } });
    }

    // A gift goes to the recipient's own saved address, chosen by the server;
    // nothing about where we'd deliver for ourselves is looked up or sent.
    const recipientTag = input.recipientTag?.trim().replace(/^@+/, "").toLowerCase();
    let addressId: string | undefined;
    if (!recipientTag) {
      const where = input.landmark.trim();
      const street = input.address.trim();
      const coordinates = await locate(input.coords, [
        [street, input.area].filter(Boolean).join(", "),
        [where, input.area].filter(Boolean).join(", "),
      ]);
      const normalizedArea = input.area.trim().toLowerCase();
      const areaId = (await listAreas()).find(
        (area) => area.name.trim().toLowerCase() === normalizedArea,
      )?.id;
      if (!coordinates && !areaId) {
        return { ok: false, error: "Pick one of the listed delivery areas so we can place it on the map." };
      }
      addressId = await saveAddress({
        line1: street || where,
        area: input.area,
        instructions: [where && street ? `Landmark: ${where}` : "", input.note.trim()].filter(Boolean).join(". ") || undefined,
        ...(coordinates ?? { areaId: areaId! }),
      });
    }

    const giftMessage = input.giftMessage?.trim();
    const order = await api<Schemas["OrderWithDetailsResponseDto"]>("/orders", {
      method: "POST",
      scope: "customer",
      body: {
        ...(recipientTag
          ? { recipientTag, ...(giftMessage ? { giftMessage } : {}) }
          : { addressId }),
        items: cart.lines.map((l) =>
          input.vendor === "store" ? { storeProductId: l.dishId, qty: l.qty } : { menuItemId: l.dishId, qty: l.qty },
        ),
        // Paystack's own page offers every method, so there's no picker here
        // any more — this is a placeholder until payment succeeds.
        provider: "PAYSTACK",
        channel: "CARD",
        ...(input.promoCode ? { promoCode: input.promoCode } : {}),
      },
    });

    // Nobody pays here. Every kitchen has to accept first, so paying only
    // happens once the order is AWAITING_PAYMENT — on the order's own page,
    // through `payForOrder`.
    return { ok: true, orderId: order.id };
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 422 &&
      error.body.code === "AREA_HAS_NO_LOCATION"
    ) {
      return {
        ok: false,
        error: "We can't place that area on the map yet. Pick the nearest area or add a landmark.",
      };
    }
    if (error instanceof ApiError && error.status === 400) {
      return { ok: false, error: error.message };
    }
    if (error instanceof ApiError && error.status === 422) {
      // The backend's 422s (outside the delivery area, below the store's
      // minimum, too many items, mixed cart, kitchen too far) each carry a
      // sentence written for the customer. Show it, not a guess.
      return { ok: false, error: error.message };
    }
    return failure(error);
  }
}

/** A delivery address for this order. The same place is reused rather than
 *  saved again, so checking out repeatedly doesn't pile up near-identical
 *  addresses; if only the rider's note changed, the saved one is updated. */
async function saveAddress(a: {
  line1: string;
  area: string;
  instructions?: string;
  areaId?: string;
  lat?: number;
  lng?: number;
}): Promise<string> {
  const existing = await api<Schemas["AddressResponseDto"][]>("/addresses", { scope: "customer" });
  const norm = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
  const same = existing.find(
    (e) =>
      norm(e.line1) === norm(a.line1) &&
      norm(e.area) === norm(a.area) &&
      // About a kilometre: the same landmark found by search or by GPS.
      (a.lat == null || a.lng == null ||
        (Math.abs(e.lat - a.lat) < 0.01 && Math.abs(e.lng - a.lng) < 0.01)),
  );
  if (same) {
    if ((same.instructions ?? "") !== (a.instructions ?? "")) {
      await api(`/addresses/${encodeURIComponent(same.id)}`, {
        method: "PATCH",
        scope: "customer",
        body: { instructions: a.instructions ?? "" },
      }).catch(() => {
        // The order can still go to the saved address; only its note stays as it was.
      });
    }
    return same.id;
  }

  const created = await api<Schemas["AddressResponseDto"]>("/addresses", {
    method: "POST",
    scope: "customer",
    body: { label: "Delivery", isDefault: existing.length === 0, ...a },
  });
  return created.id;
}

/** Where Paystack's hosted page returns to: straight back to the tracking
 *  page, which keeps checking until the payment lands. */
async function startPayment(orderId: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const result = await api<Schemas["InitializePaymentResponseDto"]>(`/payments/orders/${orderId}/pay`, {
    method: "POST",
    scope: "customer",
    body: { callbackUrl: `${proto}://${host}/track?order=${orderId}` },
  });
  return result.authorizationUrl;
}

/** Why the payment page would not open, in words for the customer. A
 *  refused return address is ours to fix, not theirs, and the backend's
 *  wording for it ("callbackUrl is not on an allowed…") means nothing to them. */
function paymentFailure(error: unknown): Failure {
  if (error instanceof ApiError && /callbackUrl/i.test(error.message)) {
    return {
      ok: false,
      error: "Your order is saved, but we can't open the payment page from this site yet. That's on our side — try Pay now again shortly.",
    };
  }
  return failure(error, "Your order is saved, but the payment page didn't open. Try Pay now again.");
}

/**
 * Open Paystack for an order — the first time, or again after a payment was
 * abandoned or failed. Only possible once every kitchen has accepted and put
 * the order into AWAITING_PAYMENT; the button is hidden outside that window,
 * but hiding is not the rule, this is.
 */
export async function payForOrder(orderId: string): Promise<Done<{ payUrl: string }>> {
  try {
    const order = await api<Schemas["OrderWithDetailsResponseDto"]>(`/orders/${encodeURIComponent(orderId)}`, {
      scope: "customer",
    });
    const kitchen = vendorNames(order) || "The kitchen";
    if (order.status === "PLACED") {
      return { ok: false, error: `${kitchen} hasn't accepted your order yet. You'll pay as soon as they do.` };
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return { ok: false, error: "This order was cancelled, so there is nothing to pay." };
    }
    if (order.status !== "AWAITING_PAYMENT") {
      return { ok: false, error: "This order is already paid." };
    }
  } catch (error) {
    return failure(error);
  }

  try {
    return { ok: true, payUrl: await startPayment(orderId) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      switch (error.body.code) {
        case "AWAITING_KITCHEN":
          return { ok: false, error: "The kitchen hasn't accepted your order yet. You'll pay as soon as they do." };
        case "PAYMENT_WINDOW_CLOSED":
          return { ok: false, error: "The window to pay for this order has closed. Order again to try once more." };
        case "ALREADY_PAID":
          return { ok: false, error: "This order is already paid." };
      }
    }
    return paymentFailure(error);
  }
}

/**
 * Ask the backend to check with Paystack directly, in case its webhook is
 * running late. Safe to call repeatedly — call it on the return page and
 * keep reading the order until it's ACCEPTED.
 */
export async function verifyPayment(orderId: string): Promise<Done> {
  try {
    await api(`/payments/orders/${encodeURIComponent(orderId)}/verify`, { method: "POST", scope: "customer" });
    return { ok: true };
  } catch (error) {
    return failure(error, "Still confirming your payment. Hang on.");
  }
}

/* -------------------------------------------------------------- tracking */

export type TrackedGift = {
  /** "sent": the customer paid for someone else; "received": someone sent it to them. */
  role: "sent" | "received";
  /** The other person's display name. */
  otherName: string | null;
  message: string | null;
};

export type TrackedOrder = {
  /** Present on a gift order. */
  gift?: TrackedGift;
  id: string;
  code: string;
  trackingToken: string | null;
  status: Schemas["OrderWithDetailsResponseDto"]["status"];
  kitchen: string;
  kitchenSlug: string;
  /** Groceries are packed, not cooked, and come from a store. */
  side: Side;
  to: string;
  items: { name: string; qty: number; lineKobo: number }[];
  subtotalKobo: number;
  feeKobo: number;
  discountKobo: number;
  creditKobo: number;
  totalKobo: number;
  pay: PayChoice;
  /** Paystack payment still to be made or confirmed. */
  payment: "paid" | "pending" | "failed" | "refunded";
  /** Set while AWAITING_PAYMENT: the deadline to pay, and what's due — both
   *  from the server, never a client-side timer (§2.3, §3). */
  paymentDueAt: string | null;
  amountDueKobo: number;
  /** Why a cancelled order was cancelled. The customer was never charged. */
  cancelReason: Schemas["OrderWithDetailsResponseDto"]["cancelReason"];
  rider: { name: string; phone: string | null } | null;
  placedAt: string;
  /** The customer has asked to cancel after the kitchen accepted, and is
   *  waiting for the kitchen to confirm. */
  cancelRequested: boolean;
};

/** Every kitchen and store an order is split across, "A + B". */
function vendorNames(order: Pick<Schemas["OrderWithDetailsResponseDto"], "kitchenOrders" | "storeOrders">): string {
  return [...order.kitchenOrders.map((k) => k.kitchen.name), ...order.storeOrders.map((s) => s.store.name)].join(" + ");
}

/** `channel` is a real method only once Paystack confirms payment; before
 *  that, or for a method we don't map (e.g. mobile money), it's a
 *  placeholder — show a neutral "paid online" rather than a wrong label. */
function payChoiceOf(p: Schemas["OrderWithDetailsResponseDto"]["payments"][number] | undefined): PayChoice {
  if (!p || p.status !== "SUCCEEDED") return "online";
  return p.channel === "BANK_TRANSFER" ? "transfer" : p.channel === "CARD" ? "card" : "online";
}

export async function fetchOrder(id: string): Promise<Done<{ order: TrackedOrder }>> {
  try {
    const o = await api<Schemas["OrderWithDetailsResponseDto"]>(`/orders/${encodeURIComponent(id)}`, {
      scope: "customer",
    });
    const p = o.payments[0];
    const g = o as unknown as {
      isGift?: boolean;
      senderDisplayName?: string | null;
      recipientDisplayName?: string | null;
      giftMessage?: string | null;
    };
    const received = g.isGift === true && g.senderDisplayName !== undefined;
    const riderUser = (o.rider?.user ?? null) as { name?: string | null; phone?: string | null } | null;
    const place = o.kitchenOrders[0]?.kitchen ?? o.storeOrders[0]?.store;

    return {
      ok: true,
      order: {
        ...(g.isGift
          ? {
              gift: {
                role: received ? ("received" as const) : ("sent" as const),
                otherName: (received ? g.senderDisplayName : g.recipientDisplayName) ?? null,
                message: g.giftMessage ?? null,
              },
            }
          : {}),
        id: o.id,
        code: o.code,
        trackingToken: o.trackingToken,
        status: o.status,
        kitchen: vendorNames(o),
        kitchenSlug: place?.slug ?? "",
        // A store sells groceries only; a kitchen's order says which side it was.
        side: o.kitchenOrders[0] ? (o.kitchenOrders[0].type === "GROCERY" ? "GROCERY" : "FOOD") : "GROCERY",
        to: [o.address.line1, o.address.area].filter(Boolean).join(", "),
        items: [...o.kitchenOrders, ...o.storeOrders].flatMap((slice) =>
          slice.items.map((i) => ({
            name: i.nameSnapshot,
            qty: i.qty,
            lineKobo: nairaToKobo(i.unitPriceNaira) * i.qty,
          })),
        ),
        subtotalKobo: nairaToKobo(o.subtotalNaira),
        feeKobo: nairaToKobo(o.deliveryFeeNaira),
        discountKobo: nairaToKobo(o.discountNaira),
        creditKobo: nairaToKobo(o.creditAppliedNaira),
        totalKobo: nairaToKobo(o.totalNaira),
        pay: payChoiceOf(p),
        payment: !p ? "pending" : ({ SUCCEEDED: "paid", PENDING: "pending", FAILED: "failed", REFUNDED: "refunded" } as const)[p.status],
        paymentDueAt: o.paymentDueAt,
        amountDueKobo: p ? nairaToKobo(p.amountNaira) : nairaToKobo(o.totalNaira),
        cancelReason: o.cancelReason,
        rider: o.rider ? { name: riderUser?.name ?? "Your rider", phone: riderUser?.phone ?? null } : null,
        placedAt: o.placedAt,
        // Only worth asking while a request could still be outstanding.
        cancelRequested:
          (o.status === "ACCEPTED" || o.status === "PREPARING" || o.status === "READY") && (await cancelRequested(o.id)),
      },
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { ok: false, error: "We can't find that order on your account. Check you're logged in with the number you ordered with." };
    }
    return failure(error);
  }
}

/** The subject line that marks a ticket as a request to cancel. It is how
 *  the order's page knows one has already been sent. */
const CANCEL_REQUEST = "Customer asked to cancel order";

async function cancelRequested(orderId: string): Promise<boolean> {
  try {
    const tickets = await api<Schemas["SupportTicketResponseDto"][]>("/support-tickets/me", { scope: "customer" });
    return tickets.some((t) => t.orderId === orderId && t.subject.startsWith(CANCEL_REQUEST));
  } catch {
    // Not knowing is not a reason to hide the order.
    return false;
  }
}

/**
 * Cancel an order. Before the kitchen accepts, the customer can simply cancel
 * it. After that karrigo-be only lets the kitchen cancel, so the request goes
 * to Karrigo's team as a ticket on the order — they reach the kitchen, and
 * the order is cancelled when the kitchen confirms. Once a rider has the food
 * there is nothing left to cancel.
 */
export async function cancelOrder(id: string): Promise<Done<{ requested: boolean }>> {
  try {
    const order = await api<Schemas["OrderWithDetailsResponseDto"]>(`/orders/${encodeURIComponent(id)}`, {
      scope: "customer",
    });

    if (order.status === "PLACED" || order.status === "AWAITING_PAYMENT") {
      try {
        await api(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", scope: "customer" });
        return { ok: true, requested: false };
      } catch (error) {
        // Paid in the moment between looking and cancelling: ask instead.
        if (!(error instanceof ApiError && error.status === 409)) throw error;
      }
    } else if (order.status !== "ACCEPTED" && order.status !== "PREPARING" && order.status !== "READY") {
      return {
        ok: false,
        error:
          order.status === "CANCELLED" || order.status === "REFUNDED"
            ? "This order is already cancelled."
            : "Your rider already has the food, so this order can't be cancelled.",
      };
    }

    if (await cancelRequested(id)) return { ok: true, requested: true };

    const kitchen = vendorNames(order);
    const paid = order.payments.some((p) => p.provider === "PAYSTACK" && p.status === "SUCCEEDED");
    await api("/support-tickets", {
      method: "POST",
      scope: "customer",
      body: {
        orderId: id,
        channel: "IN_APP",
        subject: `${CANCEL_REQUEST} ${order.code}`,
        body: `The customer wants to cancel ${order.code} from ${kitchen}, which the kitchen has already accepted. ${
          paid ? "It has been paid online, so it needs a refund." : "Nothing has been paid online."
        } Ask ${kitchen} to cancel it from their orders screen.`,
      },
    });
    return { ok: true, requested: true };
  } catch (error) {
    return failure(error);
  }
}

export async function currentCustomer(): Promise<Customer | null> {
  return getCustomer();
}
