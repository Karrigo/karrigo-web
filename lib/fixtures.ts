/**
 * Placeholder data for the marketing pages while there is no backend.
 * Every one of these is replaced by a live query in M4. Money is kobo.
 */

export type PhotoCredit = {
  artist: string;
  license: string;
  source: string;
};

export type Kitchen = {
  slug: string;
  image: string;
  /** Absent while we are still chasing the source for a replaced photo. */
  credit?: PhotoCredit;
  name: string;
  cuisine: string;
  area: string;
  emoji: string;
  distanceKm: number;
  etaMinutes: [number, number];
  deliveryFeeKobo: number;
  closedUntil?: string;
  /** A short opening-hours notice shown on the kitchen's card — the kitchen
   *  is still browsable, just not taking orders yet today. */
  opensAt?: string;
  /** The filter chip this kitchen sits under on /kitchens. */
  category: string;
  /** Checkout is blocked below this, with the shortfall shown. */
  minOrderKobo: number;
  menu: Dish[];
};

export type Store = {
  slug: string;
  image: string;
  name: string;
  category: string;
  area: string;
  etaMinutes: [number, number];
  deliveryFeeKobo?: number;
  /** Checkout is blocked below this, with the shortfall shown in naira. */
  minOrderKobo?: number;
  closesAt?: string;
};

export type Dish = {
  id: string;
  name: string;
  description: string;
  priceKobo: number;
  soldOut?: boolean;
};

export const kitchens: Kitchen[] = [
  {
    slug: "terkimbis-kitchen",
    image: "/food/poundo.jpg",
    // TODO: credit unknown for poundo.jpg — add artist, licence and source before launch.
    name: "Terkimbi's Kitchen",
    cuisine: "Swallow & soups",
    area: "Wurukum",
    emoji: "🍲",
    distanceKm: 0.8,
    etaMinutes: [20, 30],
    deliveryFeeKobo: 0,
    category: "Swallow",
    minOrderKobo: 150000,
    menu: [
      { id: "pounded-yam-egusi", name: "Pounded yam & egusi", description: "With assorted meat", priceKobo: 280000, },
      { id: "amala-ewedu", name: "Amala & ewedu", description: "Gbegiri and stew on the side", priceKobo: 240000, },
      { id: "semo-okra", name: "Semo & okra soup", description: "With fresh fish", priceKobo: 260000, },
      { id: "goat-pepper-soup", name: "Goat meat pepper soup", description: "Hot, one bowl", priceKobo: 300000, },
      { id: "zobo", name: "Zobo", description: "Chilled, 50cl", priceKobo: 50000, },
    ],
  },
  {
    slug: "sewuese-rice-spot",
    image: "/food/jollof-chicken.jpg",
    // TODO: credit unknown for jollof-chicken.jpg — add artist, licence and source before launch.
    name: "Sewuese Rice Spot",
    cuisine: "Jollof & chicken",
    area: "North Bank",
    emoji: "🍛",
    distanceKm: 1.4,
    etaMinutes: [25, 35],
    deliveryFeeKobo: 50000,
    category: "Rice",
    minOrderKobo: 150000,
    menu: [
      { id: "jollof-chicken", name: "Jollof rice & chicken", description: "Party-style, with plantain", priceKobo: 250000, },
      { id: "fried-rice-turkey", name: "Fried rice & turkey", description: "With coleslaw", priceKobo: 320000, },
      { id: "ofada-ayamase", name: "Ofada rice & ayamase", description: "Green pepper sauce", priceKobo: 270000, },
      { id: "extra-plantain", name: "Extra plantain", description: "Dodo, one portion", priceKobo: 60000, },
      { id: "chapman", name: "Chapman", description: "Chilled, 50cl", priceKobo: 80000, },
    ],
  },
  {
    slug: "benue-grills",
    image: "/food/barbeque.jpg",
    // TODO: credit unknown for barbeque.jpg — add artist, licence and source before launch.
    name: "Benue Grills",
    cuisine: "Grills & barbecue",
    area: "Judges Quarters",
    emoji: "🍖",
    distanceKm: 2.6,
    etaMinutes: [35, 45],
    deliveryFeeKobo: 80000,
    category: "Grills",
    minOrderKobo: 200000,
    menu: [
      { id: "grilled-chicken-half", name: "Grilled chicken (half)", description: "Peppered, with chips", priceKobo: 450000, },
      { id: "bbq-fish", name: "Barbecue fish", description: "Whole catfish, spicy sauce", priceKobo: 600000, },
      { id: "beef-skewers", name: "Beef skewers", description: "Four sticks", priceKobo: 280000, },
      { id: "roasted-yam", name: "Roasted yam", description: "With palm oil sauce", priceKobo: 150000, },
      { id: "malt", name: "Chilled malt", description: "33cl can", priceKobo: 70000, },
    ],
  },
  {
    slug: "modern-market-suya",
    image: "/food/meat.jpg",
    // TODO: credit unknown for meat.jpg — add artist, licence and source before launch.
    name: "Modern Market Suya",
    cuisine: "Suya & grills",
    area: "Modern Market",
    emoji: "🍢",
    distanceKm: 3.1,
    etaMinutes: [30, 40],
    deliveryFeeKobo: 90000,
    opensAt: "Opens 6pm",
    category: "Suya",
    minOrderKobo: 150000,
    menu: [
      { id: "beef-suya", name: "Beef suya", description: "Wrapped, with onions and yaji", priceKobo: 200000, },
      { id: "ram-suya", name: "Ram suya", description: "Wrapped, extra yaji", priceKobo: 250000, },
      { id: "kilishi", name: "Kilishi", description: "100g pack", priceKobo: 180000, },
      { id: "chicken-suya", name: "Chicken suya", description: "Half bird", priceKobo: 350000, },
      { id: "kunu", name: "Kunu", description: "Chilled, 50cl", priceKobo: 50000, },
    ],
  },
  {
    slug: "ankpa-bukka",
    image: "/food/egusi.jpg",
    // TODO: credit unknown for egusi.jpg — add artist, licence and source before launch.
    name: "Ankpa Bukka",
    cuisine: "Local dishes",
    area: "Ankpa Ward",
    emoji: "🍗",
    distanceKm: 3.6,
    etaMinutes: [35, 45],
    deliveryFeeKobo: 90000,
    category: "Swallow",
    minOrderKobo: 150000,
    menu: [
      { id: "egusi-eba", name: "Eba & egusi", description: "With goat meat", priceKobo: 230000, },
      { id: "vegetable-soup", name: "Pounded yam & vegetable soup", description: "Ugu and waterleaf", priceKobo: 260000, },
      { id: "ofe-onugbu", name: "Fufu & bitterleaf soup", description: "With stockfish", priceKobo: 250000, soldOut: true, },
      { id: "moi-moi", name: "Moi moi", description: "Two wraps", priceKobo: 80000, },
    ],
  },
  {
    slug: "aondona-breakfast",
    image: "/food/aondona-breakfast.jpg",
    credit: {
      artist: "Ceentia",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Bean_cake_(Akara).jpg",
    },
    name: "Aondona Breakfast",
    cuisine: "Pap, akara & tea",
    area: "High Level",
    emoji: "🥣",
    distanceKm: 1.9,
    etaMinutes: [20, 30],
    deliveryFeeKobo: 50000,
    closedUntil: "Opens 6:30am tomorrow",
    category: "Breakfast",
    minOrderKobo: 100000,
    menu: [
      { id: "akara-pap", name: "Akara & pap", description: "Six akara, one cup", priceKobo: 120000, },
      { id: "bread-egg", name: "Bread & fried egg", description: "With sweet tea", priceKobo: 110000, },
      { id: "tea", name: "Hot tea", description: "Milo or Lipton", priceKobo: 40000, },
    ],
  },
];

/** The scrolling dish rail on the homepage. Reuses photos already credited
 *  (or tracked) against a kitchen above, so it introduces no new attribution
 *  gaps — same images, priced at dish level instead of kitchen level. */
export function findKitchen(slug: string): Kitchen | undefined {
  return kitchens.find((kitchen) => kitchen.slug === slug);
}

/** The cheapest main — drinks and sides under ₦1,000 would make every
 *  kitchen look like it starts at ₦500. */
export function fromPriceKobo(kitchen: Kitchen): number {
  const mains = kitchen.menu.filter((dish) => dish.priceKobo > 100000);
  return Math.min(...(mains.length ? mains : kitchen.menu).map((d) => d.priceKobo));
}

export const stores: Store[] = [
  {
    slug: "makurdi-mega-store",
    image: "/images/fikri-rasyid-ezeC8-clZSs-unsplash.jpg",
    name: "Makurdi Mega Store",
    category: "Supermarket",
    area: "Wurukum",
    etaMinutes: [25, 40],
    deliveryFeeKobo: 70000,
    closesAt: "Open until 9pm",
  },
  {
    slug: "wurukum-provisions",
    image: "/images/jack-lee-IH65r4HEQWQ-unsplash.jpg",
    name: "Wurukum Provisions",
    category: "Provisions",
    area: "Wurukum",
    etaMinutes: [20, 35],
    minOrderKobo: 300000,
    closesAt: "Open until 9pm",
  },
  {
    slug: "high-level-mini-mart",
    image: "/images/sincerely-media-8LevB8kRhQc-unsplash.jpg",
    name: "High Level Mini Mart",
    category: "Provisions",
    area: "High Level",
    etaMinutes: [25, 40],
    deliveryFeeKobo: 60000,
    closesAt: "Open until 9pm",
  },
  {
    slug: "modern-market-fresh",
    image: "/images/alex-hudson-m3I92SgM3Mk-unsplash.jpg",
    name: "Modern Market Fresh",
    category: "Fresh produce",
    area: "Modern Market",
    etaMinutes: [30, 45],
    minOrderKobo: 250000,
    closesAt: "Open until 9pm",
  },
];

export const dishes = [
  { image: "/food/poundo.jpg" },
  { image: "/groceries/cutout/milo.webp" },
  { image: "/food/jollof-chicken.jpg" },
  { image: "/groceries/cutout/indomiepepper.webp" },
  { image: "/food/barbeque.jpg" },
  { image: "/groceries/cutout/tinpeakmilk.webp" },
  { image: "/food/meat.jpg" },
  { image: "/groceries/cutout/gpspaghetti.webp" },
  { image: "/groceries/cutout/indomiecarton.webp" },
] as const;

/** Each area's pill on the homepage's areas panel. The tones are the design's
 *  loose scatter of fills — deliberately uneven, so the row reads as a
 *  hand-placed set of stickers rather than a tag list. */
export const areasLive = [
  { name: "High Level", tone: "accent", tilt: -3 },
  { name: "Wurukum", tone: "white", tilt: 0 },
  { name: "North Bank", tone: "outline", tilt: 2 },
  { name: "Wadata", tone: "white", tilt: 1.5 },
  { name: "Modern Market", tone: "warm", tilt: -2 },
  { name: "Old GRA", tone: "outline", tilt: 0 },
  { name: "Kanshio", tone: "accent", tilt: 2.5 },
] as const;

/** Temporary fallback for the homepage growth panel while `/public/stats`
 * is unavailable. Real API totals replace these automatically. */
export const growthStats = [
  { key: "users", label: "People ordering on Karrigo", value: 12480, gain: "+318 this week" },
  { key: "downloads", label: "App downloads", value: 9260, gain: "+204 this week" },
] as const;

export const areasComingNext = [
  "Gyado Villa",
  "Achusa",
  "Logo 1",
  "Gboko — being asked for a lot",
];

export const heroStats = [
  { value: "7 areas", label: "covered today" },
  { value: "29 min", label: "average to your gate" },
  { value: "₦500", label: "delivery in your area" },
];

export const steps = [
  {
    title: "Tell us where",
    body: "An address or a landmark. We show the kitchens that reach you.",
  },
  {
    title: "Pick your food",
    body: "Real menus, today's prices, live availability.",
  },
  {
    title: "Pay your way",
    body: "Card, transfer, or cash to the rider.",
  },
  {
    title: "Watch it come",
    body: "Follow your rider on a map and call them if needed.",
  },
];

export const benefitCards = [
  {
    title: "Landmarks, not addresses",
    body: "“Behind BSU main gate” is a real address here. Tell us the school gate, the church, the filling station — our riders know the area, so you never drag a pin on a map.",
    href: "/areas",
    image: "/images/location.jpg",
    imageAlt: "A location pin",
  },
  {
    title: "Follow your rider to your gate",
    body: "Watch them leave the kitchen and come to you. Share the link so whoever is waiting can follow it too — no app, no account, and it works on a slow connection.",
    href: "/help",
    image: "/images/bike.jpg",
    imageAlt: "A delivery scooter carrying a box",
  },
  {
    title: "Pay how you actually pay",
    body: "Card, bank transfer, or cash to the rider at your door. Nothing to install and no account needed, and if an order goes wrong you reach a real person.",
    href: "/help#payment",
    image: "/images/payment.jpg",
    imageAlt: "Paying on a phone with a card",
  },
] as const;

export const faqs = [
  {
    q: "Do I need to create an account?",
    a: "No. You can order with just a phone number. We text you a link to follow the order, and you can make an account later if you want your addresses saved.",
  },
  {
    q: "What if I do not have a street address?",
    a: "Most people here do not use one. Give us a landmark — a school gate, a church, a filling station — and the area. Riders find it the same way you would tell a friend.",
  },
  {
    q: "How much is delivery?",
    a: "It depends on how far the kitchen is from you, so it is shown per kitchen before you order. It is never a surprise at checkout.",
  },
  {
    q: "Can I pay cash?",
    a: "Yes, cash to the rider when the food reaches you. Card and bank transfer also work.",
  },
  {
    q: "Which areas do you deliver to?",
    a: "Seven areas around Makurdi today. We open a new area only when we have enough riders to serve it properly, rather than taking orders we cannot deliver.",
  },
  {
    q: "Is there a minimum order for stores?",
    a: "Yes, it's set per store and shown before you check out. If your cart is below it, we'll show you exactly how much more to add.",
  },
  {
    q: "What if a store is out of something I ordered?",
    a: "The store removes it when they review your order, before they accept — you're only charged for what's actually sent. You'll see the updated total on your receipt.",
  },
];

/** Footer link columns. These exist for local search as much as navigation. */
export const cuisines = [
  "Swallow & soups",
  "Jollof & rice",
  "Pepper soup",
  "Suya & grills",
  "Breakfast",
  "Drinks",
];
