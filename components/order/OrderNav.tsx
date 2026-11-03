"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Logo } from "@/components/site/Logo";
import { SiteThemeToggle } from "@/components/site/SiteThemeToggle";
import { Screen } from "@/components/ui/Screen";
import { logOut } from "@/app/(order)/actions";
import { kitchenLogOut } from "@/app/(order)/partners/actions";
import { cartCount, say, useOrderState } from "@/lib/order/store";
import { cn } from "@/lib/cn";

/**
 * The ordering flow's header: the site's floating pill, carrying where the
 * food is going and the cart instead of the marketing links. Once the page
 * scrolls, the strip behind it frosts so menu rows do not show through.
 */
export function OrderNav({
  user,
  business,
}: {
  user: { name: string } | null;
  /** Set when a kitchen or store owner is signed in — a separate login from
   *  the customer's, so both can be true at once. */
  business: { href: string; label: string } | null;
}) {
  const router = useRouter();
  const { cart, landmark, address, area } = useOrderState();
  const [scrolled, setScrolled] = useState(false);
  const [loggingOut, startTransition] = useTransition();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = cartCount(cart);
  const where = landmark || address || area;

  return (
    <div
      className={cn(
        "px-screen-x sticky top-0 z-20 pt-md pb-md transition-[background-color,backdrop-filter] duration-(--duration-slow)",
        scrolled && "bg-surface/55 backdrop-blur-lg",
      )}
    >
      <Screen
        mode="dark"
        className="rounded-pill gap-sm mx-auto flex max-w-[1240px] items-center py-sm pr-sm pl-lg shadow-[0_12px_30px_-14px_rgba(14,15,13,0.55)]"
      >
        <Logo mode="dark" className="shrink-0" />

        <Link
          href="/kitchens"
          className="bg-text/8 hover:bg-text/16 text-text/80 rounded-pill text-label gap-sm ml-sm hidden min-w-0 items-center px-lg py-sm font-semibold transition-colors duration-(--duration-fast) sm:flex"
        >
          <span className="bg-accent size-[8px] shrink-0 rounded-full" />
          <span className="truncate">
            {where ? `Deliver to ${where}` : "Set address at checkout"}
          </span>
        </Link>

        <div className="gap-xs ml-auto flex shrink-0 items-center">
          <SiteThemeToggle />
          {business && (
            <Link
              href={business.href}
              className="text-accent-text hover:bg-accent/12 rounded-pill text-nav-link px-lg py-sm font-bold transition-colors duration-(--duration-fast)"
            >
              {business.label}
            </Link>
          )}
          {user && (
            <Link
              href="/orders"
              className="text-accent-text hover:bg-accent/12 rounded-pill text-nav-link hidden px-lg py-sm font-bold transition-colors duration-(--duration-fast) md:block"
            >
              My orders
            </Link>
          )}
          {user ? (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await logOut();
                  say("Logged out");
                  router.push("/kitchens");
                  router.refresh();
                })
              }
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="text-text/75 hover:bg-text/10 hover:text-text rounded-pill text-nav-link hidden px-lg py-sm transition-colors duration-(--duration-fast) disabled:opacity-50 sm:block"
            >
              {loggingOut ? "Logging out…" : `${user.name.split(" ")[0] || "Account"} · Log out`}
            </button>
          ) : business ? (
            // Signed in as a business only: the customer "Log in" would read as
            // if they weren't signed in at all.
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await kitchenLogOut();
                  say("Logged out");
                  router.push("/kitchens");
                  router.refresh();
                })
              }
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="text-text/75 hover:bg-text/10 hover:text-text rounded-pill text-nav-link hidden px-lg py-sm transition-colors duration-(--duration-fast) disabled:opacity-50 sm:block"
            >
              {loggingOut ? "Logging out…" : "Business · Log out"}
            </button>
          ) : (
            <Link
              href="/login"
              className="text-text/75 hover:bg-text/10 hover:text-text rounded-pill text-nav-link px-lg py-sm transition-colors duration-(--duration-fast)"
            >
              Log in
            </Link>
          )}
          {/* Checkout needs a customer login, so for a business-only session
              the cart is a dead end. Someone who is both keeps it. */}
          {(user || !business) && (
            <Link
              href="/checkout"
              className="bg-accent text-on-accent rounded-pill text-site-button gap-sm flex items-center py-sm pr-sm pl-lg transition-transform duration-(--duration-fast) hover:-translate-y-0.5"
            >
              Cart
              <span
                key={count}
                data-theme="dark"
                className="bg-bg text-accent-text rounded-pill text-label pop grid h-[22px] min-w-[22px] place-items-center px-xs font-bold"
              >
                {count}
              </span>
            </Link>
          )}
        </div>
      </Screen>
    </div>
  );
}
