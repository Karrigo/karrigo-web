# Karrigo — Frontend Developer Brief (New Admin App)

**Audience:** a frontend developer building a **new, from-scratch** admin web app for Karrigo.
**Purpose:** everything needed to get productive — what Karrigo is, what the three mobile apps already do, the full backend API surface to build against, and a from-scratch project setup including testing.

> **Note on an existing prototype:** this workspace also contains a `karrigo-admin/` folder — an earlier, partial Next.js + shadcn prototype (login + kitchen/rider approval queues) with its own `IMPLEMENTATION_PLAN.md`. **This brief is for a separate, fresh build that does not reuse that code.** It's mentioned here only so you're not confused if you come across that folder — nothing in this document assumes familiarity with it.

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [The Karrigo apps](#2-the-karrigo-apps)
3. [Mobile app feature inventory](#3-mobile-app-feature-inventory)
4. [Real-time infrastructure (Socket.IO)](#4-real-time-infrastructure-socketio)
5. [Backend architecture & data model](#5-backend-architecture--data-model)
6. [Full API reference](#6-full-api-reference)
7. [What the admin app needs to do](#7-what-the-admin-app-needs-to-do)
8. [Recommended tech stack & from-scratch setup](#8-recommended-tech-stack--from-scratch-setup)
9. [Testing strategy & setup](#9-testing-strategy--setup)
10. [Running the backend locally](#10-running-the-backend-locally)
11. [Recommended conventions](#11-recommended-conventions)
12. [Open product decisions — flagged, not resolved](#12-open-product-decisions--flagged-not-resolved)

---

## 1. Product overview

**Karrigo** is a food-delivery marketplace (Nigeria — Makurdi-area test data throughout) connecting three sides of a two-sided marketplace plus an internal ops team:

- **Customers** order food from local home kitchens via the `karrigo-eats` app.
- **Kitchens** (home cooks / small food businesses) manage their menu and fulfil orders via `karrigo-partner` (kitchen mode).
- **Riders** deliver orders via `karrigo-partner` (rider mode) — same app, different mode, since a rider is a `User` with an attached `Rider` profile, not a separate identity system.
- **Admins** (internal ops/support) approve kitchens and riders, handle refunds, trigger payouts, and (as this new app grows) manage support tickets, reviews, and platform settings.

Money flows: a customer pays via Paystack (card/bank transfer) or cash-on-delivery. Karrigo takes a 15% commission on the kitchen's subtotal (`COMMISSION_RATE`, `karrigo-be/src/common/payout-policy.ts`). Riders earn a per-order delivery fee plus wait-time pay (₦50/minute after a 5-minute free window) and keep 100% of tips. Kitchen and rider payouts are **admin-triggered, not scheduled** — there is no cron; an admin calls a "pay out" endpoint whenever, and it settles every unpaid completed order in one batch via a real Paystack transfer.

---

## 2. The Karrigo apps

| App | Stack | Who uses it |
|---|---|---|
| **karrigo-eats** | Expo / React Native | Customers |
| **karrigo-partner** | Expo / React Native (one app, two modes: kitchen staff and rider) | Kitchen owners/staff, riders |
| **karrigo-be** | NestJS + Prisma + PostgreSQL + Redis + Socket.IO | Shared backend for every client, including the new admin app |
| **The new admin app** | *yours to choose — see [§8](#8-recommended-tech-stack--from-scratch-setup)* | Internal ops/support/admin |

All client apps talk to the **same** `karrigo-be` backend, over three **structurally separate JWT auth systems** (deliberately not unified):

- Consumer/rider identity: phone + OTP (Twilio), `User` table, `JWT_ACCESS_SECRET`.
- Kitchen staff identity: email + password, `KitchenStaff` table, `KITCHEN_JWT_ACCESS_SECRET`.
- Admin identity: email + password (+ MFA fields reserved, not wired up yet), `Admin` table, `ADMIN_JWT_ACCESS_SECRET`.

The new admin app will authenticate against the **admin** system (`/admin-auth/*`, see [§6.13](#613-admin-auth--admin-auth)) and call the **admin** API surface (`/admin/*`, [§6.14](#614-admin--admin)). A kitchen-staff token or a customer/rider token is never valid there, and vice versa — mixing them up gets a 401 by design.

---

## 3. Mobile app feature inventory

This is what the admin app is *managing and observing* — even though it won't rebuild any of this UI, understanding it is essential context for every admin screen (an order refund only makes sense once you understand the order lifecycle; a rider verification screen only makes sense once you understand what a rider actually does).

### 3.1 `karrigo-eats` (customer app)

**Auth & onboarding**
- Welcome → phone entry (new vs. returning number, different copy) → OTP verify → profile completion.
- Location permission flow (a dedicated denied-state screen, not just a system prompt) — the app is location-first, since delivery area determines which kitchens are even orderable-from.
- "Outside area" / session-expired / offline states each have their own screen rather than a generic error.

**Browse & order**
- Home feed, search, a kitchen's own page (`restaurant/[id]`), a single dish's page (`dish/[id]`).
- Cart → checkout → payment method selection (Paystack card/bank vs. cash) → a dedicated "placing order" screen (polls order status after a Paystack checkout closes, since there's no live push for payment webhooks yet) → order-placed confirmation.
- Failure paths as real screens, not just toasts: `payment-failed`, `kitchen-unavailable`, `no-riders` (no rider accepted in time), `outside-area`.

**Post-order**
- Live order tracking — real-time via Socket.IO (`order:status`, `rider:location`, `rider:assigned` — see [§4](#4-real-time-infrastructure-socketio)).
- Order history and order detail.
- Rate kitchen / rate rider (separate screens, one review each, `POST /reviews`).
- Refund status and report-a-problem (creates a real `SupportTicket`).
- "Running late" — a dedicated reassurance/status screen for delayed orders.

**Account**
- Addresses (list/add), edit profile, notification preferences, help.

### 3.2 `karrigo-partner` — kitchen mode

**Auth & onboarding**
- Register (creates `KitchenStaff` OWNER + `Kitchen` in `PENDING` status in one call) / login.
- A kitchen cannot take orders until an admin approves it (`PENDING → ACTIVE`) — this is the queue the admin app's go-live approval screens manage.

**Menu management**
- Sections (create/edit/delete, `note` field, manual `sortOrder`) and items within a section (name, description, price, image upload to GCS, tags, sold-out toggle, move between sections).
- Empty sections show an explicit "no dishes yet" state rather than disappearing.
- A kitchen can't add a section/item until it has set a location (`lat`/`lng`) — a server-side gate, not just client UX.

**Orders**
- Live incoming-order screen (real-time push via `order:new`, not polling), accept/reject/prep-time flows, status progression (`PLACED → ACCEPTED → PREPARING → READY → PICKED_UP`, or `CANCELLED`), a cancel-with-reason and reject-with-reason flow.

**Hours & availability**
- `isOpen` toggle, scheduled pause ("closed until"), a dedicated hours-editing screen. Turning back on resets any `isSoldOut` items automatically.

**Money**
- "Money" tab: next-payout projection (computed live from unpaid orders, matches exactly what the real payout run would settle), sales/commission this cycle, payout history with per-order breakdown.

**Business profile**
- Business details (name, owner name, hero photo), a dedicated "Area & location" screen (GPS capture or address search → reverse-geocoded via LocationIQ into a formatted `area`, plus an optional free-text `landmarkNote`), payout bank account (Paystack NUBAN resolution — real bank-name confirmation, not a typed label).

**Account**
- Notifications, FAQ, help, report-a-problem (creates a real, kitchen-attributed `SupportTicket`).

### 3.3 `karrigo-partner` — rider mode

**Auth & onboarding**
- Riders are `User` rows with role `RIDER` — onboarding attaches a `Rider` profile (vehicle type, plate number) to an existing customer-style phone+OTP identity, no separate signup.
- Document submission (license, ID, vehicle registration — image upload), guarantor info, payout bank account — all required before verification.
- A rider can't go `AVAILABLE` until `verificationStatus` is `APPROVED` — this is the queue the admin app's rider verification screens manage.

**Trip lifecycle** (one screen per stage, driven by push, not polling)
- Offer (18-second accept/decline window) → to-kitchen → pickup (marks arrival, which is what wait-time pay measures from) → to-customer → dropoff → complete.
- Abandon (before dropoff, re-dispatches to another rider) and a problem-report path mid-trip (files a support ticket; there's no "undo delivery" endpoint, so this needs human follow-up).
- A rider only ever sees one active trip at a time — dispatch is broadcast-push (`trip:offer`) to available riders in range, first to accept wins, everyone else gets `trip:offer:taken`.

**Earnings**
- "Money" tab: today's and this-cycle's trip pay (fee + wait-time pay folded together), tips (rider keeps 100%), cash currently being held (from cash-on-delivery orders, netted against payout), payout history.
- "Trips" tab: today's completed deliveries.

**Account**
- Bank account, bike/vehicle info, documents (with re-submission if rejected, carrying a rejection note from the admin), guarantor info, notifications, FAQ, help, report-a-problem.

---

## 4. Real-time infrastructure (Socket.IO)

One gateway (`TrackingGateway`, `karrigo-be/src/api/tracking/tracking.gateway.ts`) handles three logically separate concerns over one connection, dual-authenticated (tries the consumer/rider JWT secret first, falls back to the kitchen JWT secret):

**Client → server**
| Event | Who sends it | Purpose |
|---|---|---|
| `subscribe:order` | Customer | Join an order's room to receive its status/rider-location updates |
| `rider:location` | Rider | Periodic GPS ping while on a trip |
| `dispatch:online` | Rider | Opt into receiving trip offers |
| `dispatch:offline` | Rider | Opt out |

**Server → client**
| Event | Who receives it | Purpose |
|---|---|---|
| `order:new` | Kitchen (room `kitchen:<id>`) | A new order just landed — replaces polling |
| `order:status` | Customer (subscribed to that order) | Status transition |
| `rider:assigned` | Customer | A rider accepted the order |
| `rider:location` | Customer | Live rider position |
| `trip:offer` | Rider(s) | A new delivery to accept/decline |
| `trip:offer:taken` | Every other offered rider | Someone else got it first — dismiss |
| `dispatch:offers` / `dispatch:subscribed` | Rider | Dispatch-room bookkeeping/catch-up |

**The admin app has no real-time requirement to start with** — every likely admin screen is a request/response read or a triggered mutation. Worth knowing this infra exists in case a future "live ops dashboard" wants it, but don't build socket plumbing speculatively.

---

## 5. Backend architecture & data model

**Stack:** NestJS 11 + Prisma (driver adapter, not the default client) + PostgreSQL (Railway-hosted) + Redis (pub/sub backing Socket.IO) + Socket.IO + Google Cloud Storage (image uploads, server-side — clients never talk to GCS directly) + Paystack (payments, transfers, bank resolution) + Twilio (OTP delivery) + Google Geocoding (forward search) + LocationIQ (reverse geocoding).

**Three JWT systems**, never interchangeable (see [§2](#2-the-karrigo-apps)). Each has its own access+refresh secret, its own `RefreshToken` rows (rotating — reusing an already-rotated refresh token revokes the entire chain as a tripwire), its own guard and its own `/*-auth/{login or otp,refresh,logout,me}` route group.

**Core data model** (`karrigo-be/prisma/schema.prisma` — read this file directly for exact fields; this is the map, not the territory):

| Model | What it represents |
|---|---|
| `User` | Customer or rider identity (phone+OTP). `role: CUSTOMER \| RIDER`. |
| `Rider` | 1:1 with a `User` — vehicle, verification status, documents, payout account, live lat/lng. |
| `Admin` | Internal ops account (email+password). `adminRole: SUPER_ADMIN \| MODERATOR`. Self-referential `invitedBy` chain (schema-ready, no invite endpoint exists yet). |
| `Kitchen` | A food business. `status: PENDING \| ACTIVE \| SUSPENDED`. Location, hero image, payout account, commission is a **global** constant, not per-kitchen. |
| `KitchenStaff` | Login identity for a kitchen (email+password), role `OWNER \| STAFF`, belongs to one `Kitchen`. |
| `MenuSection` / `MenuItem` | A kitchen's menu, manually ordered. |
| `Address` | A customer's saved delivery address (lat/lng + free text). |
| `Order` | The customer-facing order — one order can span multiple kitchens. |
| `KitchenOrder` | One kitchen's slice of an `Order` — its own status lifecycle, its own line items. |
| `OrderItem` | A line item within a `KitchenOrder`. |
| `Payment` | A charge attempt against an `Order` (Paystack or cash). |
| `Transaction` | The financial ledger — charges, refunds, kitchen payouts, rider payouts, cash settlements. `type` + `status` cover every money movement in the system. |
| `PromoCode` | Discount codes. **Schema exists, nothing in the codebase uses it yet** (no create/apply/admin path). |
| `Review` | One review per order per target (`KITCHEN` or `RIDER`). `isHidden` exists, nothing sets it yet. |
| `Device` | A registered push-notification token (Expo). |
| `NotificationPreference` / `UserSettings` | Per-user notification toggles and misc settings. |
| `RefreshToken` | Backs all three auth systems' rotation/revocation. |
| `SupportTicket` | Multi-actor (customer, rider, or kitchen staff — `userId` or `kitchenStaffId`, never both), `status: OPEN \| IN_PROGRESS \| RESOLVED \| CLOSED`, `channel: IN_APP \| WHATSAPP`. |
| `AuditLog` | Every admin mutation writes one (actor, action, entity, entityId, metadata). **No endpoint reads this back yet** — a future `GET /admin/audit-log` is pure upside, the data already exists. |

**Business policy constants** (`karrigo-be/src/common/payout-policy.ts`) — the single source of truth; read these from API responses rather than hardcoding a copy in the admin app:
- `COMMISSION_RATE = 0.15` — Karrigo's cut of a kitchen's subtotal.
- `FREE_WAIT_MINUTES = 5`, `WAIT_PAY_PER_MINUTE_NAIRA = 50` — rider wait-time pay at a kitchen.

---

## 6. Full API reference

Base URL in dev: `http://localhost:3000/v1` (global `/v1` prefix on every route below). Guards are noted per group; `[OWNER]` means additionally gated by `@KitchenStaffRoles(OWNER)` (not relevant to the admin app itself, included for completeness since the whole surface is documented here).

### 6.1 Consumer auth — `/auth` (public unless noted)

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/auth/otp/request` | public | `{ phone, channel?: 'sms'\|'voice'\|'whatsapp' }` |
| POST | `/auth/otp/verify` | public | `{ phone, code }` → token pair, creates `User` if new |
| POST | `/auth/refresh` | public | `{ refreshToken }` |
| POST | `/auth/logout` | public | `{ refreshToken }` |
| GET | `/auth/me` | `JwtAuthGuard` | current user |
| PATCH | `/auth/me` | `JwtAuthGuard` | `{ name?, email? }` |

### 6.2 Addresses — `/addresses` — `JwtAuthGuard`

| Method | Path | Body / notes |
|---|---|---|
| GET | `/addresses` | list own |
| POST | `/addresses` | `{ label, area, city?, state?, lat, lng, isDefault?, instructions? }` |
| PATCH | `/addresses/:id` | partial of the above |
| DELETE | `/addresses/:id` | |

### 6.3 Public kitchen catalog — `/kitchens` — public

| Method | Path | Notes |
|---|---|---|
| GET | `/kitchens` | list active kitchens |
| GET | `/kitchens/:slug` | one kitchen + its menu |
| GET | `/kitchens/:slug/items/:itemSlug` | one dish |

### 6.4 Orders (consumer) — `/orders` — `JwtAuthGuard`

| Method | Path | Body / notes |
|---|---|---|
| POST | `/orders` | `{ addressId, items: [{menuItemId, qty}], promoCode?, provider: PaymentProvider, channel? }` |
| GET | `/orders` | own order history |
| GET | `/orders/:id` | detail |
| POST | `/orders/:id/cancel` | |

### 6.5 Payments — `/payments`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/payments/banks` | public | Paystack bank reference list |
| POST | `/payments/orders/:orderId/pay` | `JwtAuthGuard` | initializes a Paystack checkout, returns a hosted-page URL |
| POST | `/payments/webhook/paystack` | public (HMAC-verified) | Paystack's own callback — `charge.success` etc. |

### 6.6 Reviews — `/reviews` — `JwtAuthGuard`

| Method | Path | Body |
|---|---|---|
| POST | `/reviews` | `{ orderId, target: 'KITCHEN'\|'RIDER', rating, comment? }` |

### 6.7 Support tickets (self-service) — `/support-tickets` — `JwtAuthGuard`

| Method | Path | Body |
|---|---|---|
| POST | `/support-tickets` | `{ orderId?, channel?: 'WHATSAPP'\|'IN_APP', subject, body? }` |
| GET | `/support-tickets/me` | own tickets |

### 6.8 Push devices — `/devices` — `JwtAuthGuard`

| Method | Path | Body |
|---|---|---|
| POST | `/devices` | `{ expoPushToken, platform: 'ios'\|'android' }` |
| DELETE | `/devices/:expoPushToken` | |

### 6.9 Notification preferences — `/notifications/preferences` — `JwtAuthGuard`

| Method | Path | Body |
|---|---|---|
| GET | `/notifications/preferences` | |
| PATCH | `/notifications/preferences/:key` | `{ enabled }` |

### 6.10 Kitchen auth — `/kitchen-auth`

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/kitchen-auth/register` | public | `{ name, email, password, phone?, kitchenName, cuisine?, area? }` — creates `KitchenStaff`(OWNER) + `Kitchen`(PENDING) |
| POST | `/kitchen-auth/login` | public | `{ email, password }` |
| POST | `/kitchen-auth/refresh` | public | `{ refreshToken }` |
| POST | `/kitchen-auth/logout` | public | `{ refreshToken }` |
| GET | `/kitchen-auth/me` | `KitchenJwtAuthGuard` | |

### 6.11 Kitchen console — `/kitchen-console` — `KitchenJwtAuthGuard`

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | `/kitchen-console/kitchen` | any staff | own kitchen |
| GET | `/kitchen-console/geocode?query=` | any staff | forward geocode (Google) |
| GET | `/kitchen-console/reverse-geocode?lat=&lng=` | any staff | reverse geocode (LocationIQ) |
| PATCH | `/kitchen-console/kitchen` | `[OWNER]` | `{ name?, cuisine?, area?, lat?, lng?, landmarkNote?, emoji?, heroImageUrl?, noticeText?, feeNaira?, isOpen? }` |
| PATCH | `/kitchen-console/kitchen/payout-account` | `[OWNER]` | `{ bankCode, accountNumber }` — Paystack-resolved |
| GET | `/kitchen-console/kitchen/payouts` | `[OWNER]` | settled payout history |
| GET | `/kitchen-console/kitchen/earnings-summary` | `[OWNER]` | next-payout projection |
| POST | `/kitchen-console/kitchen/hero-image` | `[OWNER]` | multipart, field `file` |
| POST | `/kitchen-console/support-tickets` | any staff | `{ subject, body? }` |
| GET | `/kitchen-console/support-tickets` | any staff | |
| POST | `/kitchen-console/menu/sections` | any staff | `{ label, note?, sortOrder? }` |
| PATCH | `/kitchen-console/menu/sections/:id` | any staff | |
| DELETE | `/kitchen-console/menu/sections/:id` | any staff | |
| POST | `/kitchen-console/menu/items` | any staff | `{ sectionId, name, description?, priceNaira, imageUrl?, tags?, sortOrder? }` |
| PATCH | `/kitchen-console/menu/items/:id` | any staff | incl. `isSoldOut?`, `sectionId?` (moves sections) |
| POST | `/kitchen-console/menu/items/:id/image` | any staff | multipart, field `file` |
| DELETE | `/kitchen-console/menu/items/:id` | any staff | |
| GET | `/kitchen-console/orders` | any staff | |
| PATCH | `/kitchen-console/orders/:id/status` | any staff | `{ status: KitchenOrderStatus }` |

### 6.12 Riders (consumer identity, RIDER role) — `/riders` — `JwtAuthGuard` + `@Roles(RIDER)` except onboard

| Method | Path | Body / notes |
|---|---|---|
| POST | `/riders/onboard` | `{ vehicleType?, plateNumber? }` — attaches a `Rider` to the caller |
| GET | `/riders/me` | |
| PATCH | `/riders/me/status` | `{ status: 'AVAILABLE'\|'OFFLINE' }` |
| POST | `/riders/me/documents` | multipart, `{ kind }` + field `file` |
| PATCH | `/riders/me/guarantor` | `{ guarantorName, guarantorPhone, guarantorAddress }` |
| PATCH | `/riders/me/payout-account` | `{ bankCode, accountNumber }` |
| GET | `/riders/me/payouts` | settled payout history |
| GET | `/riders/me/earnings-summary` | today + this-cycle projection |
| GET | `/riders/me/trips/today` | today's completed deliveries |
| POST | `/riders/orders/:id/accept` | |
| POST | `/riders/orders/:id/arrived` | marks kitchen arrival (starts wait-pay clock) |
| POST | `/riders/orders/:id/abandon` | unassigns, re-dispatches |
| POST | `/riders/orders/:id/report-problem` | `{ reason }` |
| POST | `/riders/orders/:id/deliver` | settles cash payment, flips rider `AVAILABLE` |

### 6.13 Admin auth — `/admin-auth` ⭐ *your app's login*

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/admin-auth/login` | public | `{ email, password }` |
| POST | `/admin-auth/refresh` | public | `{ refreshToken }` |
| POST | `/admin-auth/logout` | public | `{ refreshToken }` |
| GET | `/admin-auth/me` | `AdminJwtAuthGuard` | `{ adminId, adminRole, name, email }` |

You'll need a seeded admin account to log in during development — see `karrigo-be/prisma/seed-admin.ts` (`ADMIN_SEED_EMAIL=you@karrigo.app ADMIN_SEED_PASSWORD=... pnpm seed:admin`). There is currently no self-service way to create an admin account through any API — it's hand-seeded, or created by a future "invite an admin" endpoint that doesn't exist yet (see [§7](#7-what-the-admin-app-needs-to-do)).

### 6.14 Admin — `/admin` — `AdminJwtAuthGuard` ⭐ *your app's primary data surface*

| Method | Path | Body / notes |
|---|---|---|
| GET | `/admin/kitchens?status=` | list, filterable by `PENDING\|ACTIVE\|SUSPENDED` |
| GET | `/admin/kitchens/:id` | detail |
| PATCH | `/admin/kitchens/:id/status` | `{ status: 'ACTIVE'\|'SUSPENDED', note? }` — `PENDING` is never a target; approve → `ACTIVE`, reject/suspend → `SUSPENDED` (same status covers both, no separate "rejected" state) |
| GET | `/admin/riders?verificationStatus=` | list, filterable by `PENDING\|APPROVED\|REJECTED` |
| GET | `/admin/riders/:id` | detail |
| GET | `/admin/riders/:id/documents` | short-lived signed GCS URLs — fetch on-demand, never pre-load or cache |
| PATCH | `/admin/riders/:id/verification` | `{ status: 'APPROVED'\|'REJECTED', note? }` — `note` **required** when rejecting |
| POST | `/admin/orders/:id/refund` | `{ note? }` — needs a known order id, no browse endpoint exists yet (see gaps below) |
| POST | `/admin/kitchens/:id/payout` | triggers a real Paystack transfer for every unpaid completed order |
| POST | `/admin/riders/:id/payout` | same, nets cash already collected |
| POST | `/admin/notifications/sweep-push-receipts` | stale Expo push-token cleanup |

Every mutation above writes an `AuditLog` row.

`AdminRolesGuard` / `@AdminRoles(SUPER_ADMIN)` exists in the codebase and is wired into the guard chain, but **no route currently uses it** — every admin route today is reachable by both `SUPER_ADMIN` and `MODERATOR`. Whether that should change (and for which routes — payouts and refunds are the obvious candidates) is a real product decision, not something to assume (see [§12](#12-open-product-decisions--flagged-not-resolved)).

**This is the entire admin API that exists today.** Anything the new app needs beyond this list is backend work that hasn't been built yet — see the gap list in the next section.

---

## 7. What the admin app needs to do

The likely feature set, and what backend work (if any) blocks each piece. Sequence roughly by what unblocks day-to-day platform operation first — approvals before analytics.

### 7.1 Ships against the existing API, no backend work needed

- **Auth** — login/logout/session via `/admin-auth/*`.
- **Kitchen approval queue** — list by status, view detail, approve/suspend/reactivate via `PATCH /admin/kitchens/:id/status`.
- **Rider verification queue** — list by status, view detail (including a KYC document viewer using the signed URLs), approve/reject via `PATCH /admin/riders/:id/verification`.
- **Manual refund** — given a known order id, `POST /admin/orders/:id/refund`.
- **Manual payout trigger** — given a known kitchen/rider id, `POST /admin/kitchens/:id/payout` / `POST /admin/riders/:id/payout`.
- **Push-token cleanup** — a button calling `POST /admin/notifications/sweep-push-receipts`.

This alone is real, valuable, shippable — it replaces every admin action that today happens by hand with `curl` and a manually-signed JWT.

### 7.2 Needs new backend endpoints first

| Need | Missing endpoint(s) |
|---|---|
| Browse/search orders (refund currently requires already knowing the order id) | `GET /admin/orders` (filter by status/kitchen/rider/customer/date), `GET /admin/orders/:id` |
| Financial ledger / reconciliation view | `GET /admin/transactions` (filter by type/status) over the existing `Transaction` model |
| "Who's actually due a payout" (payout trigger currently requires already knowing who to pay) | `GET /admin/payouts/due` |
| Customer/user directory (only pending kitchens/riders are visible today — no way to look up an active kitchen, an approved rider, or any customer) | `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/status` (`UserStatus.SUSPENDED` exists in the schema, unused) |
| Full kitchen/rider directories (not just the pending queue) | Richer `GET /admin/kitchens/:id` (staff list, menu count, recent orders, rating) and `GET /admin/riders/:id` (recent trips, payout history, rating) |
| Support ticket inbox | `GET /admin/support-tickets`, `GET /admin/support-tickets/:id`, `PATCH /admin/support-tickets/:id/status` |
| Review moderation | `GET /admin/reviews`, `PATCH /admin/reviews/:id` (toggle `isHidden`, matching the existing rating-recompute logic) |
| Admin team management | `POST /admin/admins`, `GET /admin/admins`, `PATCH /admin/admins/:id/status` — the schema (`Admin.invitedById`) and RBAC guard are ready, nothing routes to them yet |
| Audit log viewer | `GET /admin/audit-log` — pure read, the data is already being written on every mutation |
| Dashboard / KPIs | `GET /admin/dashboard/summary` (orders today, GMV, pending-approval counts, open-ticket count) — one aggregate endpoint, not N+1 calls from the frontend |
| Promo codes | Full CRUD — the `PromoCode` model exists and is completely unused anywhere in the codebase today |

**Don't build a screen against a guessed response shape for any row in this table.** Get the backend endpoint built and its real shape confirmed first.

---

## 8. Recommended tech stack & from-scratch setup

This is a genuinely new project — nothing below is pre-installed anywhere. Recommendations, not mandates; swap anything the team already has a standard for.

### 8.1 Framework & UI

```bash
bunx create-next-app@latest karrigo-admin --typescript --tailwind --app --src-dir --import-alias "@/*"
cd karrigo-admin
bunx shadcn@latest init
```

`shadcn init` will prompt for a style and base color — either is fine; pick the current default ("New York") unless there's a specific brand direction to match. Add components as you need them:

```bash
bunx shadcn@latest add button card table dialog alert-dialog form input label select tabs sidebar badge dropdown-menu
```

**shadcn UI is a hard requirement here** — this is explicitly what was asked for, and it gives you accessible, composable primitives (built on Radix) without shipping a heavy component-library runtime.

### 8.2 Data layer

- **Server Components for reads, Server Actions for writes** — this is a Next.js App Router app talking to a REST backend; there's no need for a client-side data-fetching library (TanStack Query/SWR) unless a specific screen needs genuine client-side interactivity beyond what Server Actions + `revalidatePath`/`redirect` cover. Don't add one speculatively.
- **`zod`** for validating form input before it hits the backend — already the validation library of choice across the mobile apps, worth the same convention here.
- **Session**: store the admin's access/refresh token pair as **httpOnly cookies**, not `localStorage` — this app will hold refund/payout/suspend authority, real financial and account actions.

### 8.3 Suggested project structure

```
app/
  (dashboard)/
    layout.tsx          # sidebar shell, auth-gated
    kitchens/
    riders/
    orders/              # once §7.2's endpoints exist
    ...
  actions/               # Server Actions, one file per resource
  login/
lib/
  admin-api.ts            # fetch wrapper: attaches the session token, retries once on 401 via refresh, normalizes errors
  session.ts               # cookie read/write
  dal.ts                    # the real per-request auth check (see Next.js's Data Access Layer guidance)
components/
  ui/                        # shadcn-generated primitives
  confirm-action-dialog.tsx   # one shared component behind every destructive action
```

The `admin-api.ts` retry-on-401 pattern should mirror what the mobile apps already do (`karrigo-partner/src/lib/api-client.ts`'s `apiFetch`): attach the bearer token, and on a 401 call `POST /admin-auth/refresh` once and retry, rather than immediately bouncing the user to `/login`.

---

## 9. Testing strategy & setup

### 9.1 Install

```bash
bun add -d vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @playwright/test
bunx playwright install --with-deps chromium
```

### 9.2 Unit + integration tests — Vitest + React Testing Library

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['node_modules', '.next', 'e2e'],
  },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

**Convention: co-locate tests next to the file they test** (`lib/session.ts` → `lib/session.test.ts`).

**Unit tests** (`lib/*.test.ts`): pure logic with no rendering — `lib/session.ts`'s cookie read/write (mock `next/headers`), the response-parsing/error-normalization logic inside `lib/admin-api.ts` (mock global `fetch`).

```ts
// lib/admin-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminFetch } from './admin-api';

describe('adminFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('throws a typed error on a non-2xx response', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not found.' }), { status: 404 }),
    );
    await expect(adminFetch('/admin/kitchens/x')).rejects.toMatchObject({
      status: 404,
      message: 'Not found.',
    });
  });
});
```

**Component/integration tests** (`components/*.test.tsx`, `app/**/*.test.tsx`): render with React Testing Library, assert on user-visible behavior — e.g. a rejection dialog requires a note before its submit button enables, a status-filter tab links to the right `?status=` query. Mock Server Actions passed as props/`action=` rather than hitting the real network.

```json
// package.json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### 9.3 E2E tests — Playwright

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Isolation matters more here than in a typical app**: core actions are irreversible and financial (refund, payout, suspend). E2E tests must **not** run against a real backend with real Paystack credentials pointed at production-like data. Two approaches — pick deliberately:

1. **Seeded test backend** — run `karrigo-be` against a disposable test database with Paystack in test mode, seed known fixtures (a `PENDING` kitchen, a `PENDING` rider) before each run, delete them after.
2. **Route interception** — `page.route()` to intercept calls to `karrigo-be` and return fixture JSON; fully deterministic, doesn't touch a real backend, but doesn't catch real integration breakage.

Recommended split: a handful of real-backend smoke tests (login → approve a seeded kitchen → confirm it moves tabs) with approach 1, and the bulk of scenario coverage (validation errors, empty states, permission edges) with approach 2.

```ts
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('a wrong password shows an error and does not redirect', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@karrigo.app');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
```

```json
// package.json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

**Minimum e2e coverage for the first shipped slice** ([§7.1](#71-ships-against-the-existing-api-no-backend-work-needed)): login success/failure, approve a pending kitchen, reject a pending kitchen (note required), approve/reject a pending rider (note required on reject), sign-out clears the session.

### 9.4 CI recommendation

- Run lint, `tsc --noEmit`, unit/integration tests, and `next build` on every push/PR — fast, no external dependencies.
- Run e2e either pre-merge (if seed/teardown is fast enough) or on a schedule, against a seeded test backend — don't block every commit on a real backend round-trip until you know the suite's actual runtime.

---

## 10. Running the backend locally

```bash
cd karrigo-be
pnpm install
pnpm start:dev   # nest start --watch, defaults to :3000
```

Then run the new admin app against `http://localhost:3000/v1`. If you scaffold the admin app inside this workspace, run it on a different port (e.g. `bun run dev -- --port 3001`) to avoid colliding with the backend.

Seed an admin account to log in with:

```bash
cd karrigo-be
ADMIN_SEED_EMAIL=you@karrigo.app ADMIN_SEED_PASSWORD=... pnpm seed:admin
```

---

## 11. Recommended conventions

- **Reads via Server Components, writes via Server Actions.** No client-side `fetch` straight to the backend.
- **Every destructive/irreversible/financial action sits behind a confirmation dialog** — refund, payout, suspend, reject. One shared component, not N near-duplicates.
- **Status filters as URL query params** (`?status=`), not client component state — every tab should be a real, shareable, server-rendered link.
- **Session tokens in httpOnly cookies**, never `localStorage`.
- **Don't build a screen against a guessed backend response shape** — if the endpoint doesn't exist yet ([§7.2](#72-needs-new-backend-endpoints-first)), the backend work comes first.
- **Verify against real (seeded, then cleaned-up) data before calling something done** — not just "it typechecks and builds."

---

## 12. Open product decisions — flagged, not resolved

Real decisions for product/eng leadership, not implementation details to default silently on:

1. **RBAC scope** — which admin routes should actually be `SUPER_ADMIN`-only? Every route today is reachable by `MODERATOR` too. Payouts and refunds (real money movement) are the obvious candidates worth a real answer before building admin-team-management.
2. **Support-ticket replies** — does resolving a ticket just need a status flip, or does a WhatsApp-channel ticket need an actual outbound message sent back to the customer? Very different scopes.
3. **`PromoCode` ownership** — the model exists and is fully unused. Is promo-code management even in scope for this admin app, or a separate future tool?
4. **MFA** — `Admin.mfaEnabled`/`mfaSecret` are reserved in the schema. Near-term requirement given the app's financial authority, or backlog?

---

*Questions this document can't answer belong with whoever owns the backend work in [§7.2](#72-needs-new-backend-endpoints-first), or with whoever owns product decisions for Karrigo ([§12](#12-open-product-decisions--flagged-not-resolved)).*
