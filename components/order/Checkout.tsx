"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { formatKobo } from "@/lib/money";
import { deliverySchema, firstIssue } from "@/lib/order/schema";
import {
  addDish,
  clearCart,
  keepOnly,
  removeDish,
  say,
  setDelivery,
  useHydrated,
  useOrderState,
} from "@/lib/order/store";
import { addressAt, placeOrder, priceCartAction, validatePromo } from "@/app/(order)/actions";
import { AddressSearch } from "./AddressSearch";
import type { Customer, PricedCart } from "@/lib/shop/types";
import { cn } from "@/lib/cn";
import { QtyStepper } from "./QtyStepper";
import { basketIssue } from "@/lib/shop/limits";
import { placeHref } from "@/lib/shop/paths";

const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)";
const fieldLabel = "text-label flex flex-col gap-sm font-bold";

export function Checkout({
  customer,
  areas,
  businessSignedIn = false,
}: {
  customer: Customer | null;
  areas: string[];
  /** A kitchen or store owner is signed in: they can't place orders. */
  businessSignedIn?: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { cart, landmark, address, area } = useOrderState();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [promo, setPromo] = useState("");
  const [discount, setDiscount] = useState<{ code: string; kobo: number } | null>(null);
  const [busy, startTransition] = useTransition();

  // Priced against the live menu every time the cart changes — never from
  // anything remembered on this phone.
  const [priced, setPriced] = useState<PricedCart | null>(null);
  /** The cart contents the last answer was for. */
  const [pricedFor, setPricedFor] = useState("");
  const [pricingError, setPricingError] = useState("");
  const latest = useRef(0);

  const cartKey = cart ? `${cart.kitchenSlug}:${cart.side}:${JSON.stringify(cart.lines)}` : "";
  const checking = hydrated && Boolean(cart) && pricedFor !== cartKey;
  useEffect(() => {
    if (!hydrated || !cart) return;
    const ticket = ++latest.current;
    priceCartAction(cart.kitchenSlug, cart.lines, cart.side).then((result) => {
      if (ticket !== latest.current) return;
      setPricedFor(cartKey);
      if (!result.ok) return setPricingError(result.error);
      setPricingError("");
      setPriced(result.cart);
      // A dish that sold out while it sat in the cart is dropped from it, and
      // named above the button below.
      if (result.cart?.unavailable.length) keepOnly(result.cart.lines.map((l) => l.dishId));
    });
    // cartKey captures the cart's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, cartKey]);

  // A promo's value depends on the subtotal, so it is re-checked when that moves.
  const subtotal = priced?.subtotalKobo ?? 0;
  useEffect(() => {
    if (!discount) return;
    validatePromo(discount.code, subtotal).then((r) => setDiscount(r.ok ? { code: r.code, kobo: r.discountKobo } : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  if (!hydrated || (checking && !priced)) {
    return <div aria-busy="true" className="bg-bg/60 rounded-panel-lg mx-auto h-[420px] max-w-[1240px] animate-pulse" />;
  }

  if (!cart || !priced || priced.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1240px]">
        <h1 className="text-section-small md:text-section mt-sm mb-xl">Checkout</h1>
        <div className="bg-bg rounded-panel-sm px-xl py-[48px] text-center">
          {pricingError ? (
            <>
              <p className="text-site-title">We couldn&rsquo;t check your cart</p>
              <p className="text-site-body text-text-secondary mt-sm mb-xl">{pricingError}</p>
              <Button type="button" variant="accent" size="site" onClick={() => router.refresh()}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <p className="text-site-title">
                {priced === null && cart ? "That place isn't taking orders" : "Your cart is empty"}
              </p>
              <p className="text-site-body text-text-secondary mt-sm mb-xl">
                {cart?.side === "GROCERY" ? "Pick a store and add a few products." : "Pick a kitchen and add a few dishes."}
              </p>
              <ButtonLink href={cart?.side === "GROCERY" ? "/stores" : "/kitchens"} variant="accent" size="site">
                {cart?.side === "GROCERY" ? "Browse stores" : "Browse kitchens"}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    );
  }

  const { kitchen } = priced;
  const side = priced.side;
  const issue = basketIssue({
    side,
    name: kitchen.name,
    count: priced.count,
    subtotalKobo: priced.subtotalKobo,
    maxItems: kitchen.maxItems,
    minOrderKobo: kitchen.minOrderKobo,
  });
  // An estimate: delivery is priced by distance when the order is placed, so
  // the total here uses the kitchen's "from" delivery fee and says so. The
  // exact amount is on the order's page before anyone pays.
  const creditKobo = Math.min(customer?.creditKobo ?? 0, Math.max(0, priced.estimatedTotalKobo - (discount?.kobo ?? 0)));
  const totalKobo = Math.max(0, priced.estimatedTotalKobo - (discount?.kobo ?? 0) - creditKobo);

  function useMyLocation() {
    if (!("geolocation" in navigator)) return say("This browser can't share its location. The landmark is enough.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(here);
        say("Got your location");
        // Name the spot for the rider, but never overwrite what they typed.
        if (!customer || address.trim()) return;
        const named = await addressAt(here.lat, here.lng);
        if (named.ok && named.address) setDelivery({ address: named.address });
      },
      () => say("No problem — your landmark is enough"),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  function applyPromo() {
    if (!promo.trim()) return;
    startTransition(async () => {
      const result = await validatePromo(promo, priced!.subtotalKobo);
      if (!result.ok) return setError(result.error);
      setError("");
      setDiscount({ code: result.code, kobo: result.discountKobo });
      setPromo("");
    });
  }

  function place() {
    if (businessSignedIn) return;
    if (!customer) {
      router.push("/login?next=/checkout");
      return;
    }
    const parsed = deliverySchema.safeParse({ landmark, address, area, note });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setError("");

    startTransition(async () => {
      const result = await placeOrder({
        kitchenSlug: kitchen.slug,
        side,
        lines: cart!.lines,
        landmark: parsed.data.landmark,
        address: parsed.data.address,
        area: parsed.data.area,
        note: parsed.data.note,
        // Paystack requires an email to send a receipt to. Most customers
        // never see a field for this — it's only asked for once, and we
        // don't collect it anywhere else yet, so a receipts@ placeholder,
        // unique per account, stands in until email collection is designed.
        email: customer.email ?? `${customer.id}@receipts.karrigo.app`,
        promoCode: discount?.code,
        coords: coords ?? undefined,
      });
      if (!result.ok) return setError(result.error);
      clearCart();
      // Paid from the order's page, once every kitchen has accepted.
      router.push(`/track?order=${result.orderId}`);
    });
  }

  return (
    <div className="mx-auto max-w-[1240px]">
      <h1 className="text-section-small md:text-section mt-sm mb-xl">Checkout</h1>

      <div className="gap-xl flex flex-wrap items-start">
        <div className="gap-lg flex min-w-0 flex-[2_1_480px] flex-col">
          <section className="bg-bg rounded-panel-sm p-xl md:p-xxl gap-md flex flex-col">
            <h2 className="text-h1 font-extrabold">Where should we bring it?</h2>
            <label className={fieldLabel}>
              Landmark
              <input
                value={landmark}
                onChange={(e) => { setDelivery({ landmark: e.target.value }); setError(""); }}
                placeholder="Behind BSU main gate, blue gate"
                className={field}
              />
            </label>
            <label className={fieldLabel}>
              Area
              <select
                value={area}
                onChange={(e) => { setDelivery({ area: e.target.value }); setError(""); }}
                className={cn(field, "appearance-none")}
              >
                <option value="">Pick your area</option>
                {[...new Set([...areas, ...(area ? [area] : [])])].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              Street address (optional)
              <AddressSearch
                value={address}
                searchable={!!customer}
                onChange={(text) => { setDelivery({ address: text }); setError(""); }}
                onPick={(place) => {
                  setDelivery({ address: place.label });
                  setCoords({ lat: place.lat, lng: place.lng });
                  setError("");
                }}
                className={field}
              />
            </label>
            <label className={fieldLabel}>
              Note for the {side === "GROCERY" ? "store" : "kitchen"} or rider
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={side === "GROCERY" ? "Call when you reach the junction" : "Less pepper, call when you reach the junction"}
                className={cn(field, "resize-y")}
              />
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              className="text-accent-text text-site-label self-start font-bold"
            >
              {coords ? "✓ Location shared — tap to update" : "Help the rider: share my location (optional)"}
            </button>
          </section>

          <section className="bg-bg rounded-panel-sm p-xl md:p-xxl">
            <h2 className="text-h1 font-extrabold">Payment</h2>
            <p className="text-site-body text-text-secondary mt-sm">
              You&rsquo;ll pay securely on Paystack once the kitchen accepts — card, bank transfer or USSD, whichever you prefer.
            </p>
          </section>
        </div>

        <aside className="bg-bg rounded-panel-sm p-xl sticky top-[96px] min-w-0 flex-[1_1_320px]">
          <div className="gap-sm flex items-baseline justify-between">
            <h2 className="text-h1 font-extrabold">{kitchen.name}</h2>
            <Link href={placeHref(kitchen.slug, side)} className="text-accent-text text-site-label font-bold whitespace-nowrap">
              Add more
            </Link>
          </div>

          {!kitchen.open && (
            <p className="bg-danger-bg text-danger-text rounded-field text-site-label mt-md px-md py-sm font-semibold">
              {kitchen.name} is closed right now{kitchen.notice ? `: ${kitchen.notice}` : "."}
            </p>
          )}
          {priced.unavailable.length > 0 && (
            <p className="bg-danger-bg text-danger-text rounded-field text-site-label mt-md px-md py-sm font-semibold">
              {kitchen.name} has run out of {priced.unavailable.join(", ")}. We took it out of your {side === "GROCERY" ? "basket" : "order"}.
            </p>
          )}

          <div className="gap-md mt-md flex flex-col">
            {priced.lines.map((line) => (
              <div key={line.dishId} className="gap-sm flex items-center">
                <div className="text-site-label min-w-0 flex-1 font-semibold">
                  {line.name}
                  <div className="text-text-secondary mt-[2px] font-bold">{formatKobo(line.lineKobo)}</div>
                </div>
                <QtyStepper
                  tone="light"
                  qty={line.qty}
                  name={line.name}
                  onAdd={() => addDish({ slug: kitchen.slug, name: kitchen.name, side }, line.dishId)}
                  onRemove={() => removeDish(line.dishId)}
                />
              </div>
            ))}
          </div>

          <div className="mt-lg flex gap-sm">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && applyPromo()}
              placeholder="Promo code"
              aria-label="Promo code"
              className={cn(field, "min-w-0 flex-1 py-sm uppercase")}
            />
            <button type="button" onClick={applyPromo} disabled={busy} className="bg-surface-raised rounded-pill text-nav-link px-lg font-bold">
              Apply
            </button>
          </div>

          <dl className="border-surface-raised text-site-label text-text-secondary mt-lg gap-sm flex flex-col border-t pt-md font-semibold">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatKobo(priced.subtotalKobo)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>from {formatKobo(priced.deliveryFromKobo)}</dd>
            </div>
            {discount && (
              <div className="text-accent-text flex justify-between">
                <dt>Promo {discount.code}</dt>
                <dd>−{formatKobo(discount.kobo)}</dd>
              </div>
            )}
            {creditKobo > 0 && (
              <div className="text-accent-text flex justify-between">
                <dt>Karrigo credit</dt>
                <dd>−{formatKobo(creditKobo)}</dd>
              </div>
            )}
            <div className="text-h1 text-text mt-xs flex justify-between font-extrabold">
              <dt>Estimated total</dt>
              <dd>from {formatKobo(totalKobo)}</dd>
            </div>
          </dl>
          <p className="text-site-label text-text-secondary mt-sm">
            Delivery depends on how far you are from {kitchen.name}. You&rsquo;ll see the exact fee on your order before you pay.
          </p>

          {issue && (
            <p role="alert" className="bg-danger-bg text-danger-text rounded-field text-site-label mt-md px-md py-sm font-semibold">
              {issue.message}
            </p>
          )}

          {error && (
            <p role="alert" className="text-danger-text text-site-label shake mt-md font-semibold">
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={place}
            variant="dark"
            size="site"
            full
            className="mt-lg"
            disabled={busy || checking || !kitchen.open || issue !== null || businessSignedIn}
          >
            {busy
              ? "Placing your order…"
              : businessSignedIn
                ? "Ordering is off for business logins"
              : issue?.kind === "BELOW_MINIMUM"
                ? `Add ${formatKobo(issue.shortfallKobo)} more to check out`
              : customer
                ? `Place order · from ${formatKobo(totalKobo)}`
                : "Log in to place order"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
