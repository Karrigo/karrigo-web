/**
 * The ordering flow's view of karrigo-be: money already in kobo, nothing the
 * customer has no use for (payout accounts, review notes). Safe in client
 * components.
 */

export type ShopDish = {
  id: string;
  name: string;
  description: string;
  priceKobo: number;
  soldOut: boolean;
  imageUrl: string | null;
  tags: string[];
  /** How a grocery product is sold, "1 kg" or "pack of 6". Empty for food. */
  unit: string;
};

export type ShopSection = {
  id: string;
  label: string;
  note: string | null;
  dishes: ShopDish[];
};

/** A kitchen, or a store (its own business with its own catalog). Both are
 *  browsed, carted and ordered the same way; only the backend line differs. */
export type Vendor = "kitchen" | "store";

export type ShopKitchen = {
  id: string;
  /** Which kind of place this is. A store sells groceries only. */
  vendor: Vendor;
  slug: string;
  name: string;
  emoji: string | null;
  cuisine: string;
  area: string;
  landmarkNote: string | null;
  imageUrl: string | null;
  open: boolean;
  /** The kitchen's own words, e.g. "Closed for Sallah". */
  notice: string | null;
  /** The least delivery can cost from here: the kitchen's rider base fee
   *  (₦1,500 if it has not set one). The real fee also grows with distance
   *  and is fixed when the order is placed, so always show this as "from". */
  deliveryFromKobo: number;
  rating: number;
  ratingsCount: number;
  /** A store's own rules, from the backend. Only applied to grocery orders. */
  minOrderKobo: number | null;
  maxItems: number | null;
};

/** The two things a customer can order. A place serving both has a page for each. */
export type Side = "FOOD" | "GROCERY";

export type ShopMenu = ShopKitchen & { side: Side; sections: ShopSection[] };

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  /** Store credit, applied in full at the next checkout. */
  creditKobo: number;
};

/** The cart priced against the live menu. */
export type PricedLine = {
  dishId: string;
  name: string;
  qty: number;
  unitKobo: number;
  lineKobo: number;
};

export type PricedCart = {
  side: Side;
  kitchen: ShopKitchen;
  lines: PricedLine[];
  /** Names of dishes that sold out or left the menu since they were added. */
  unavailable: string[];
  count: number;
  subtotalKobo: number;
  /** Same "from" figure as the kitchen's: an estimate, not the charge. */
  deliveryFromKobo: number;
  /** subtotal + deliveryFromKobo — the least the order can come to. */
  estimatedTotalKobo: number;
};
