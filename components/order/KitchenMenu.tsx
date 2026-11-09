"use client";

import Image from "next/image";
import Link from "next/link";
import { Screen } from "@/components/ui/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { formatKobo } from "@/lib/money";
import { addDish, cartCount, removeDish, useOrderState } from "@/lib/order/store";
import { basketIssue } from "@/lib/shop/limits";
import type { ShopMenu } from "@/lib/shop/types";
import { cn } from "@/lib/cn";
import { QtyStepper } from "./QtyStepper";

export function KitchenMenu({
  menu,
  browseOnly = false,
}: {
  menu: ShopMenu;
  /** A kitchen or store owner is signed in. They can look around, as a
   *  customer would see it, but not order. */
  browseOnly?: boolean;
}) {
  const { cart } = useOrderState();
  const grocery = menu.side === "GROCERY";
  const inThisKitchen =
    cart?.kitchenSlug === menu.slug && cart.side === menu.side && (cart.vendor ?? "kitchen") === menu.vendor;
  const closed = !menu.open;

  // The menu on this page is fresh from the server, so the sidebar is priced
  // from it directly — a dish that has since sold out is simply left out.
  const dishes = new Map(menu.sections.flatMap((s) => s.dishes).map((d) => [d.id, d]));
  const lines = inThisKitchen
    ? Object.entries(cart?.lines ?? {}).flatMap(([id, qty]) => {
        const dish = dishes.get(id);
        return dish && !dish.soldOut ? [{ dish, qty, lineKobo: dish.priceKobo * qty }] : [];
      })
    : [];
  const subtotalKobo = lines.reduce((sum, l) => sum + l.lineKobo, 0);
  const issue = basketIssue({
    side: menu.side,
    name: menu.name,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalKobo,
    maxItems: menu.maxItems,
    minOrderKobo: menu.minOrderKobo,
  });
  const gone = inThisKitchen
    ? Object.keys(cart?.lines ?? {}).filter((id) => !dishes.get(id) || dishes.get(id)!.soldOut)
    : [];

  return (
    <div className="gap-xl mx-auto flex max-w-[1240px] flex-wrap items-start">
      <div className="gap-lg flex min-w-0 flex-[2_1_520px] flex-col">
        <Link
          href={grocery ? "/stores" : "/kitchens"}
          className="bg-bg hover:bg-surface-raised rounded-pill text-site-label self-start px-lg py-sm font-bold transition-colors duration-(--duration-fast)"
        >
          {grocery ? "← All stores" : "← All kitchens"}
        </Link>

        <Screen mode="dark" className="rounded-panel-md grid overflow-hidden sm:grid-cols-2">
          <div className="p-xxl md:p-pad-card flex flex-col justify-center">
            <h1 className="text-panel-small md:text-panel text-cream text-balance">{menu.name}</h1>
            <p className="text-site-body text-cream/62 mt-sm">
              {menu.cuisine} · {menu.area}
            </p>
            {menu.landmarkNote && <p className="text-site-label text-cream/50 mt-xs">{menu.landmarkNote}</p>}
            <div className="gap-xs text-site-chip text-cream mt-lg flex flex-wrap">
              {menu.ratingsCount > 0 && (
                <span className="bg-text/10 rounded-pill px-md py-xs">
                  ★ {menu.rating.toFixed(1)} ({menu.ratingsCount})
                </span>
              )}
              <span className="bg-accent/16 text-accent-text rounded-pill px-md py-xs">
                Delivery from {formatKobo(menu.deliveryFromKobo)}
              </span>
              {grocery && menu.minOrderKobo ? (
                <span className="bg-text/10 rounded-pill px-md py-xs">Min. {formatKobo(menu.minOrderKobo)}</span>
              ) : null}
              {grocery && menu.maxItems ? (
                <span className="bg-text/10 rounded-pill px-md py-xs">Up to {menu.maxItems} items</span>
              ) : null}
            </div>
          </div>
          <div className="bg-surface-raised relative grid min-h-[220px] place-items-center">
            {menu.imageUrl ? (
              <Image
                src={menu.imageUrl}
                alt={`${menu.cuisine} from ${menu.name}`}
                fill
                priority
                sizes="(max-width: 640px) 100vw, 420px"
                className="object-cover"
              />
            ) : (
              <span aria-hidden className="text-[88px]">
                {menu.emoji ?? (grocery ? "🛒" : "🍲")}
              </span>
            )}
          </div>
        </Screen>

        {closed && (
          <p className="bg-danger-bg text-danger-text rounded-panel-xs text-site-label px-lg py-md font-semibold">
            {menu.name} is closed right now{menu.notice ? `: ${menu.notice}` : "."} You can look, but not order yet.
          </p>
        )}
        {!closed && menu.notice && (
          <p className="bg-accent/15 text-accent-text rounded-panel-xs text-site-label px-lg py-md font-semibold">
            {menu.notice}
          </p>
        )}

        {menu.sections.every((s) => s.dishes.length === 0) ? (
          <p className="bg-bg rounded-panel-sm text-site-body text-text-secondary p-xxl text-center font-semibold">
            {menu.name} hasn&rsquo;t put any {grocery ? "products" : "dishes"} on yet.
          </p>
        ) : (
          menu.sections
            .filter((s) => s.dishes.length > 0)
            .map((section) => (
              <section key={section.id} className="bg-bg rounded-panel-sm px-lg py-sm md:px-xl">
                <h2 className="text-h1 pt-lg font-extrabold">{section.label}</h2>
                {section.note && <p className="text-site-label text-text-secondary mt-xs">{section.note}</p>}
                {section.dishes.map((dish) => {
                  const qty = inThisKitchen ? (cart?.lines[dish.id] ?? 0) : 0;
                  return (
                    <div
                      key={dish.id}
                      className="border-surface-raised gap-lg flex items-center border-b px-xs py-lg last:border-b-0"
                    >
                      {dish.imageUrl && (
                        <div className={cn("relative size-[72px] shrink-0 overflow-hidden rounded-field", dish.soldOut && "opacity-50")}>
                          <Image src={dish.imageUrl} alt="" fill sizes="72px" className="object-cover" />
                        </div>
                      )}
                      <div className={cn("min-w-0 flex-1", dish.soldOut && "opacity-50")}>
                        <div className="text-site-question">{dish.name}</div>
                        {dish.unit && <div className="text-site-label text-text-secondary mt-xs">{dish.unit}</div>}
                        {dish.categories.length > 0 && (
                          <div className="gap-xs mt-xs flex flex-wrap">
                            {dish.categories.map((name) => (
                              <span key={name} className="bg-surface-raised rounded-pill text-site-label text-text-secondary px-sm font-semibold">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        {dish.description && (
                          <div className="text-site-label text-text-secondary mt-xs">{dish.description}</div>
                        )}
                        <div className="text-site-body mt-sm font-bold">{formatKobo(dish.priceKobo)}</div>
                      </div>

                      {dish.soldOut ? (
                        <span className="text-site-label text-text-secondary max-w-[16ch] text-right font-semibold">
                          {menu.name} has run out of this today
                        </span>
                      ) : closed || browseOnly ? null : qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addDish({ slug: menu.slug, name: menu.name, side: menu.side, vendor: menu.vendor }, dish.id)}
                          className="bg-accent text-on-accent rounded-pill text-nav-link shrink-0 px-xl py-md font-bold transition-transform duration-(--duration-fast) hover:-translate-y-0.5 active:scale-95"
                        >
                          Add
                        </button>
                      ) : (
                        <QtyStepper
                          qty={qty}
                          name={dish.name}
                          onAdd={() => addDish({ slug: menu.slug, name: menu.name, side: menu.side, vendor: menu.vendor }, dish.id)}
                          onRemove={() => removeDish(dish.id)}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            ))
        )}
      </div>

      <aside className="bg-bg rounded-panel-sm p-xl sticky top-[96px] min-w-0 flex-[1_1_300px]">
        <h2 className="text-h1 font-extrabold">{browseOnly ? "Customer view" : "Your order"}</h2>

        {browseOnly ? (
          <p className="text-site-label text-text-secondary mt-md">
            This is how customers see {menu.name}. You&rsquo;re signed in to your business, so ordering is switched off.
            Log out of it to order as a customer.
          </p>
        ) : cart && !inThisKitchen ? (
          <>
            <p className="bg-danger-bg text-danger-text rounded-field text-site-label mt-md px-md py-sm font-semibold">
              Your cart has {cartCount(cart)} item{cartCount(cart) === 1 ? "" : "s"} from {cart.kitchenName}
              {cart.side !== menu.side ? ` (${cart.side === "GROCERY" ? "groceries" : "food"})` : ""}. Adding here starts
              a new cart.
            </p>
            <ButtonLink href="/checkout" variant="muted" size="site" full className="mt-lg">
              Go to {cart.kitchenName}&rsquo;s cart
            </ButtonLink>
          </>
        ) : lines.length === 0 ? (
          <p className="text-site-label text-text-secondary mt-md">
            {closed ? `${menu.name} isn't taking orders right now.` : grocery ? "Nothing yet. Tap Add on a product to start." : "Nothing yet. Tap Add on a dish to start."}
          </p>
        ) : (
          <>
            {gone.length > 0 && (
              <p className="bg-danger-bg text-danger-text rounded-field text-site-label mt-md px-md py-sm font-semibold">
                {menu.name} has run out of something in your cart. It&rsquo;s been left out below.
              </p>
            )}
            <div className="gap-sm mt-md flex flex-col">
              {lines.map((line) => (
                <div key={line.dish.id} className="gap-sm text-site-label flex font-semibold">
                  <span className="text-accent-text shrink-0">{line.qty}×</span>
                  <span className="min-w-0 flex-1">{line.dish.name}</span>
                  <span className="shrink-0">{formatKobo(line.lineKobo)}</span>
                </div>
              ))}
            </div>
            <div className="border-surface-raised text-site-body mt-lg flex justify-between border-t pt-md font-bold">
              <span>Subtotal</span>
              <span>{formatKobo(subtotalKobo)}</span>
            </div>
            {issue && (
              <p className="bg-danger-bg text-danger-text rounded-field text-site-label mt-md px-md py-sm font-semibold">
                {issue.kind === "BELOW_MINIMUM"
                  ? `Add ${formatKobo(issue.shortfallKobo)} more to reach ${menu.name}'s ${formatKobo(menu.minOrderKobo ?? 0)} minimum.`
                  : issue.message}
              </p>
            )}
            <ButtonLink href="/checkout" variant="dark" size="site" full className="mt-lg">
              Go to checkout
            </ButtonLink>
          </>
        )}
      </aside>
    </div>
  );
}
