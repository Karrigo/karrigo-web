/**
 * The backend runs three separate identity systems that never accept each
 * other's tokens (see ADMIN_APP_FRONTEND_BRIEF.md §2). Each gets its own pair
 * of httpOnly cookies and its own refresh endpoint.
 *
 * Shared between `proxy.ts` (which rotates tokens) and the server-side client
 * (which reads them), so it imports nothing from Next.
 */

export type Scope = "admin" | "customer" | "kitchen" | "store";

export const SCOPES: Record<
  Scope,
  { access: string; refresh: string; refreshPath: string }
> = {
  admin: {
    access: "karrigo_ops_at",
    refresh: "karrigo_ops_rt",
    refreshPath: "/admin-auth/refresh",
  },
  customer: {
    access: "karrigo_at",
    refresh: "karrigo_rt",
    refreshPath: "/auth/refresh",
  },
  kitchen: {
    access: "karrigo_kt",
    refresh: "karrigo_krt",
    refreshPath: "/kitchen-auth/refresh",
  },
  // A store owner signs in to the store on its own. The backend would accept
  // either token for either console, so keeping the sessions apart is what
  // stops a store login from opening the kitchen (and the reverse).
  store: {
    access: "karrigo_st",
    refresh: "karrigo_srt",
    refreshPath: "/store-auth/refresh",
  },
};

export const API_URL = (
  process.env.KARRIGO_API_URL ?? "https://rx.karrigo.app/v1"
).replace(/\/$/, "");

/** The refresh token outlives the access token by days; this is only a
 *  ceiling so a stolen laptop is not signed in for a month. */
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Reads `exp` from a JWT without verifying it — the server verifies; this
 *  only decides whether to refresh early. Returns 0 when unreadable. */
export function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === "number" ? exp : 0;
  } catch {
    return 0;
  }
}
