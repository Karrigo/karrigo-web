/**
 * The "verified" label on kitchens and stores: a super admin sets it, it is
 * independent of status, and the lists can be narrowed by it.
 */

export type VerifiedFilter = "all" | "verified" | "unverified";

export const VERIFIED_FILTERS: { key: VerifiedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Not verified" },
];

/** Reads `?verified=` from the URL. Anything but "true" or "false" (a typo, a
 *  repeated param) falls back to All rather than erroring the page. */
export function parseVerifiedFilter(raw: string | string[] | undefined): VerifiedFilter {
  if (raw === "true") return "verified";
  if (raw === "false") return "unverified";
  return "all";
}

/** The value the backend's `verified` query expects; undefined sends no param. */
export function verifiedQuery(filter: VerifiedFilter): boolean | undefined {
  return filter === "all" ? undefined : filter === "verified";
}

/** The `?verified=` value for a filter, or "" for All (no param). */
export function verifiedParam(filter: VerifiedFilter): string {
  return filter === "all" ? "" : String(filter === "verified");
}

/** The admin detail endpoints send `verified`; the admin list rows send only
 *  the raw `verifiedAt`. Either says the same thing. */
export function isVerified(row: { verified?: boolean; verifiedAt?: string | null }): boolean {
  return row.verified ?? row.verifiedAt != null;
}
