/** The orders worth a toast: ones not seen on the last look, on a side whose
 *  orders page is not the one open (that board already shows them). Nothing at
 *  all on the first look, which only learns what was already waiting. */
export function freshOrders<T extends { side: "kitchen" | "store"; id: string }>(
  before: ReadonlySet<string> | null,
  waiting: readonly T[],
  pathname: string,
): T[] {
  if (!before) return [];
  return waiting.filter((o) => !before.has(orderKey(o)) && !pathname.startsWith(`/my-${o.side}/orders`));
}

export const orderKey = (o: { side: string; id: string }) => `${o.side}:${o.id}`;
