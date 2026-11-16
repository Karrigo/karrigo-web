# Build order

Ten milestones. Each one ends with something you can actually look at or use.
Don't skip ahead — later milestones assume earlier ones exist.

Prompts below are written to paste directly into Claude Code.

---

## M0 · Foundations

> Read CLAUDE.md, SCHEMA.sql and API.md. Scaffold a Next.js 15 App Router project
> in TypeScript with Tailwind and Prisma. Convert SCHEMA.sql into a Prisma schema,
> connect to Supabase Postgres, and run the first migration. Set up `theme.ts` as
> the single source of design tokens and wire the Tailwind config to read from it.
> Add Zod, an `env.ts` that validates environment variables at boot, and a seed
> script using the seed hints at the bottom of SCHEMA.sql. Do not build any UI yet.

**Done when:** `bunx prisma studio` shows seeded areas, restaurants and menu items.

---

## M1 · Design system in code

> Build the shared component library from `theme.ts`: Button (accent, dark,
> outline, ghost, muted), TextField, PhoneField that formats as you type,
> OtpInput with auto-advance and paste-fill, ListRow, Chip, BackButton,
> FeatureIcon, RestaurantRow, and Sheet. Support both light and dark token sets
> via a `data-theme` attribute. Build a `/kitchen-sink` route rendering every
> component in both modes. Match `design/mkart-theme-modes.html` exactly.

**Done when:** `/kitchen-sink` matches the design file side by side.

---

## M2 · Marketing site

> Build the public pages from `design/mkart-website.html`: home, /partners,
> /areas, and /help. Server Components, no client JS beyond the address input.
> The address field resolves an area and routes to /kitchens. The "ask Karrigo to
> come" and "list your kitchen" forms write to the database. Mobile-first,
> tested at 390px.

**Done when:** Lighthouse performance above 90 on a throttled 3G profile.

---

## M3 · Auth

> Implement phone OTP per API.md. Integrate Termii for SMS. Build the screens from
> `design/mkart-auth-flow.html` — all 13, including wrong code, code not arriving,
> locked out, offline and location denied. Sessions as JWT in an httpOnly cookie.
> Roles come back with the session; if a user has more than one, show "Continue
> as". Enforce the rate limits in API.md server-side.

**Done when:** you can sign up on your own phone and receive a real SMS.

---

## M4 · Discovery

> Build /kitchens and /k/[slug] from `design/mkart-home-feed-v3.html` and
> `design/mkart-restaurant-page.html`. Restaurants sort by real PostGIS distance
> from the selected address. Delivery fee comes from `delivery_fee_bands`, per
> restaurant — never a flat number. Closed restaurants appear in a separate
> section below, never hidden. Sold-out dishes stay visible, greyed, labelled
> "Finished for today". Build search across dishes and restaurant names with its
> empty state.

**Done when:** changing your address visibly reorders the feed and changes fees.

---

## M5 · Cart

> Build the cart from `design/mkart-cart.html`, all nine states. Enforce one
> restaurant per cart — adding from another returns 409 and the client shows the
> "start a new cart?" sheet. Implement `POST /api/cart/validate` returning the
> `issues[]` array, and call it on cart open and at checkout entry. Handle
> below-minimum with the shortfall in naira, sold-out-while-in-cart, restaurant
> closed meanwhile, and undo on removing the last item.

**Done when:** marking a dish sold out in the database and reopening the cart
shows the sold-out banner with a corrected total.

---

## M6 · Checkout and payments

> Build checkout from `design/mkart-website.html` page 07 and
> `design/mkart-checkout-flow.html`. Guest checkout with a phone number only —
> no forced account creation. Integrate Paystack for card and transfer; cash
> skips payment and goes straight to `awaiting_restaurant`. Implement the
> transactional order creation in API.md exactly: revalidate, recompute, snapshot,
> then create. Verify the webhook signature and trust the webhook over the client
> redirect. Build payment-failed and order-placed screens.

**Done when:** a Paystack test card produces an order, and killing the browser
mid-payment still resolves correctly via webhook.

---

## M7 · Restaurant dashboard

> Build the restaurant surface from `design/mkart-restaurant-phone.html`, phone
> first. Order board with Cooking/Ready/Done tabs, full-screen incoming order with
> a 3-minute timer and prep-time selection, reject-with-reason where "a dish has
> finished" immediately marks those items sold out, menu with instant sold-out
> toggles, pause for 15/30/60 minutes, hours, and payouts showing gross,
> commission and net. Enforce `restaurant_staff` role server-side on every route.
> Add the hourly job that resets sold-out flags at opening time.

**Done when:** toggling a dish off on the restaurant screen removes it from the
customer menu within seconds.

---

## M8 · Tracking

> Build `/t/[publicToken]` — public, no auth, from `design/mkart-website.html`
> page 08. Realtime status via Supabase Realtime. Mapbox map showing the route and
> rider position. Return only what a stranger should see: never the customer's
> phone or full address. Send the tracking link by SMS when an order is placed.
> Build the customer order history, receipt and both rating screens.

**Done when:** you can open the tracking link on a logged-out phone and watch
status change live.

---

## M9 · Admin

> Build the ops panel from `design/karrigo-admin.html`, served on its own host
> (see "Two domains, one deployment" in CLAUDE.md): overview, live order board
> with manual rider assignment and cancel-with-refund, kitchen and rider
> approval queues, issues, and the money screen — payouts and refunds, super
> admin only. Roles server-enforced, with an audit log of every action.

**Done when:** ops can resolve a stuck order without touching the database.

**Where it is now.** The ops panel and the ordering flow run on the live
`karrigo-be` API (`KARRIGO_API_URL`; the OpenAPI spec is saved in
`api/openapi.json`, types in `lib/api/schema.d.ts`, regenerate with
`bun run api:types`). Sign-in, kitchen and rider approvals, orders, refunds,
payouts, issues and the overview are real, and every mutation is a Server
Action that re-checks the role. Tokens live in httpOnly cookies and
`proxy.ts` rotates them before a page renders.

Still to do:

- Admin screens the API supports but the panel doesn't show yet: customers
  directory, review moderation, promo codes, admin team, audit log.
- Live updates on the order board — the backend has Socket.IO, but it isn't in
  the OpenAPI spec. Today the board is refreshed with the Refresh button.
- Public order tracking with no login: karrigo-be has no share-token endpoint.
- Customers and Settings: designed as "next", not built.
- Phone layout: the design has one, only the desktop layout is built.

---

## M10 · Hardening

> Add Sentry, structured logging and uptime monitoring. Write integration tests
> for the order lifecycle, cart validation and payment webhooks. Verify the whole
> flow on a throttled 3G profile on a low-end Android device. Add automated
> database backups and actually restore one to prove it works. Write the runbook
> for: payment gateway down, restaurant not responding, rider accident, duplicate
> charge.

---

## After the web app

The React Native app reuses this API entirely. Build it in the same order:
auth → discovery → cart → checkout → tracking. The rider app is a separate,
smaller build and has **no design yet** — do not start it without one.

---

## Working notes for Claude Code

- **One milestone per session.** Compact context between them.
- **Commit at every milestone** with a message naming the milestone.
- **Ask before inventing business rules.** The open questions in CLAUDE.md are
  genuinely open — guessing at them will cost a rewrite.
- **When the design and the spec disagree, ask.** Don't silently pick one.
- **Never mock payments, SMS or maps to "make tests pass."** Use sandbox
  credentials so failures surface now rather than in Makurdi.
