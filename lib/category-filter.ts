/** Pure helpers for the customer category filter (?category=<id>), kept apart from the server fetch so a bun test can import them. */

type Known = { id: string }[] | null | undefined;

/** The category id to filter by, or undefined for the unfiltered list. An unknown, deactivated, repeated or malformed value, or a category list that failed to load, all fall back to unfiltered rather than erroring. */
export function resolveCategoryParam(raw: string | string[] | undefined, known: Known): string | undefined {
  const id = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!id || !known) return undefined;
  return known.some((c) => c.id === id) ? id : undefined;
}

/** Link target for a chip on a list page. Null (the "All" chip) drops the param. */
export function categoryHref(pathname: string, id: string | null): string {
  return id ? `${pathname}?category=${encodeURIComponent(id)}` : pathname;
}

/** Names of an item's categories; empty when an older server omits the field. */
export function categoryNames(categories: { name: string }[] | null | undefined): string[] {
  return (categories ?? []).map((c) => c.name);
}
