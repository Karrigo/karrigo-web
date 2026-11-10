/**
 * The ops sections, in the order they appear down the sidebar.
 *
 * Paths here are the ones ops sees in the address bar. The pages themselves
 * live under `app/(admin)/admin/…`, and `proxy.ts` maps the admin host onto
 * that prefix — so this file says `/orders`, never `/admin/orders`. Links and
 * redirects must use these, or the prefix leaks into the URL.
 */

export type OpsSection = {
  href: string;
  label: string;
  /** Designed but not built yet. Shown, greyed, marked "next" — ops can see
   *  what is coming rather than wondering whether it is broken. */
  later?: boolean;
  /** Which count to show as a badge, if any. */
  badge?: "kitchens" | "riders" | "issues";
};

export const OPS_NAV: OpsSection[] = [
  { href: "/", label: "Overview" },
  { href: "/orders", label: "Live orders" },
  { href: "/kitchens", label: "Kitchens", badge: "kitchens" },
  { href: "/stores", label: "Stores" },
  { href: "/flagged", label: "Flagged items" },
  { href: "/riders", label: "Riders", badge: "riders" },
  { href: "/customers", label: "Customers" },
  { href: "/money", label: "Money" },
  { href: "/issues", label: "Issues", badge: "issues" },
  { href: "/reviews", label: "Reviews" },
  { href: "/promos", label: "Promo codes" },
  { href: "/areas", label: "Areas" },
  { href: "/categories", label: "Categories" },
  { href: "/team", label: "Team" },
  { href: "/audit", label: "Audit log" },
];

export const LOGIN_PATH = "/login";

/** Active when it is the page, not merely a prefix of it — otherwise "/"
 *  matches everything. */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The prefix the ops pages actually live under on disk. */
export const OPS_ROUTE_PREFIX = "/admin";

/**
 * The on-disk route for one of the paths above.
 *
 * Use this for every server-side `redirect()`, and the clean path everywhere
 * else. A Server Action's redirect is resolved inside Next and never passes
 * through `proxy.ts`, so `redirect("/login")` finds the *customer's* login
 * page — both surfaces are in this codebase and both have one. Naming the
 * real route is unambiguous, and the proxy rewrites the address bar back to
 * the clean path on the browser's next request.
 */
export function opsRoute(path: string): string {
  return path === "/" ? OPS_ROUTE_PREFIX : `${OPS_ROUTE_PREFIX}${path}`;
}
