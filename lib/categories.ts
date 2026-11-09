/** Pure so a bun test can import it. Mirrors karrigo-partner's category-selection. */
export const MAX_CATEGORIES = 5;

export type Category = { id: string; name: string; type: "FOOD" | "GROCERY" };

/** Adds the id, or removes it when already picked. Adding past MAX_CATEGORIES is a no-op. */
export function toggleCategory(
  selected: string[],
  id: string,
  max: number = MAX_CATEGORIES,
): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  if (selected.length >= max) return selected;
  return [...selected, id];
}

/** At least one, at most MAX_CATEGORIES (the API keeps the field optional for old app builds). */
export function hasValidCategories(
  selected: string[],
  max: number = MAX_CATEGORIES,
): boolean {
  return selected.length >= 1 && selected.length <= max;
}

/** Ids to prefill an edit form with; empty when the item has none (or an old server omits the field). */
export function initialCategoryIds(
  categories: { id: string }[] | null | undefined,
): string[] {
  return (categories ?? []).slice(0, MAX_CATEGORIES).map((c) => c.id);
}

/** Keeps only ids in the active list and reports whether any were dropped (e.g. deactivated since). */
export function partitionKnownIds(
  selected: string[],
  known: { id: string }[],
): { ids: string[]; dropped: boolean } {
  const ids = selected.filter((id) => known.some((k) => k.id === id));
  return { ids, dropped: ids.length < selected.length };
}
