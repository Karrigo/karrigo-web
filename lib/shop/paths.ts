import type { Side, Vendor } from "./types";

/** A place's page. Food is the default; a kitchen's grocery page names its
 *  side. A store has a page of its own, since its slug is its own. */
export function placeHref(slug: string, side: Side = "FOOD", vendor: Vendor = "kitchen"): string {
  if (vendor === "store") return `/stores/${slug}`;
  return `/k/${slug}${side === "GROCERY" ? "?type=GROCERY" : ""}`;
}
