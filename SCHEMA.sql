-- ============================================================================
-- Karrigo — PostgreSQL schema
-- ============================================================================
-- Conventions:
--   * All money in KOBO as integers. ₦2,800 = 280000. Never floats.
--   * All timestamps UTC, timestamptz.
--   * Soft deletes via deleted_at where history matters.
--   * Times of day stored as `time`, interpreted in Africa/Lagos.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";   -- for coverage polygons and distance

-- ============================================================================
-- USERS & ROLES
-- ============================================================================

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           varchar(20)  NOT NULL UNIQUE,   -- E.164, e.g. +2348012345678
  name            varchar(80),
  email           varchar(160),                   -- optional, asked after order 1
  phone_verified  boolean      NOT NULL DEFAULT false,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  last_seen_at    timestamptz,
  deleted_at      timestamptz
);

-- A phone number can be a customer AND run a kitchen. Roles are additive.
CREATE TYPE role_kind AS ENUM ('customer', 'restaurant_staff', 'rider', 'admin');

CREATE TABLE user_roles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          role_kind NOT NULL,
  restaurant_id uuid,          -- set when role = restaurant_staff
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, restaurant_id)
);

-- OTP. Rate limited in the application layer as well.
CREATE TABLE otp_codes (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone        varchar(20) NOT NULL,
  code_hash    varchar(120) NOT NULL,        -- never store the plain code
  channel      varchar(10) NOT NULL DEFAULT 'sms',  -- sms | voice
  attempts     smallint NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON otp_codes (phone, created_at DESC);

-- ============================================================================
-- GEOGRAPHY — coverage and delivery pricing
-- ============================================================================

CREATE TABLE areas (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         varchar(80) NOT NULL,          -- 'High Level', 'Wurukum'
  slug         varchar(80) NOT NULL UNIQUE,
  boundary     geography(POLYGON, 4326),      -- coverage polygon
  is_live      boolean NOT NULL DEFAULT false,
  launched_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Requests to open a new area. Feeds the ops expansion list.
CREATE TABLE area_requests (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  raw_text    varchar(160) NOT NULL,          -- 'Gboko'
  lat         double precision,
  lng         double precision,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Distance-banded delivery pricing. Fee is NOT flat.
CREATE TABLE delivery_fee_bands (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  max_km      numeric(4,1) NOT NULL,          -- upper bound of the band
  fee_kobo    integer NOT NULL,
  rider_kobo  integer NOT NULL,               -- what the rider is paid
  active      boolean NOT NULL DEFAULT true
);
-- e.g. (1.0, 50000, 45000), (3.0, 80000, 65000), (5.0, 110000, 90000)

CREATE TABLE addresses (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        varchar(20),                   -- 'Home', 'Office', 'Other'
  landmark     varchar(200) NOT NULL,         -- 'Behind BSU main gate'
  rider_note   varchar(200),                  -- 'Gate is painted blue'
  area_id      uuid REFERENCES areas(id),
  lat          double precision,
  lng          double precision,
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX ON addresses (user_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- RESTAURANTS
-- ============================================================================

CREATE TABLE restaurants (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               varchar(120) NOT NULL,
  slug               varchar(120) NOT NULL UNIQUE,
  cuisine            varchar(120),             -- 'Swallow & soups'
  area_id            uuid REFERENCES areas(id),
  landmark           varchar(200),
  lat                double precision NOT NULL,
  lng                double precision NOT NULL,
  phone              varchar(20),
  hero_image_url     text,
  commission_bps     integer NOT NULL DEFAULT 1500,  -- basis points; 1500 = 15%
  min_order_kobo     integer NOT NULL DEFAULT 200000,
  payout_bank        varchar(80),
  payout_account     varchar(20),
  payout_account_name varchar(120),

  -- live state
  is_approved        boolean NOT NULL DEFAULT false,
  is_open            boolean NOT NULL DEFAULT false,  -- manual switch
  paused_until       timestamptz,                     -- 'too busy' pause
  closing_note       varchar(160),                    -- 'Open until the pot finishes'

  rating_avg         numeric(2,1),
  rating_count       integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE restaurant_hours (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  weekday       smallint NOT NULL,          -- 0 = Sunday
  opens_at      time,
  closes_at     time,
  is_closed     boolean NOT NULL DEFAULT false,
  UNIQUE (restaurant_id, weekday)
);

CREATE TABLE menu_sections (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          varchar(60) NOT NULL,        -- 'Swallow', 'Soups'
  note          varchar(160),                -- 'Sold by the portion'
  sort_order    smallint NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  section_id    uuid REFERENCES menu_sections(id) ON DELETE SET NULL,
  name          varchar(120) NOT NULL,
  description   varchar(300),
  price_kobo    integer NOT NULL,
  image_url     text,
  prep_minutes  smallint NOT NULL DEFAULT 25,
  is_active     boolean NOT NULL DEFAULT true,   -- on the menu at all

  -- "finished for today". Resets to available at opening time.
  sold_out_until_open boolean NOT NULL DEFAULT false,
  sold_out_at         timestamptz,

  sort_order    smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX ON menu_items (restaurant_id) WHERE deleted_at IS NULL;

-- Optional extras: 'extra assorted meat' +₦500
CREATE TABLE menu_item_options (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id  uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name          varchar(80) NOT NULL,
  price_kobo    integer NOT NULL DEFAULT 0,
  is_available  boolean NOT NULL DEFAULT true
);

-- ============================================================================
-- CARTS
-- ============================================================================
-- One kitchen per cart. Enforced by the unique constraint below plus app logic.

CREATE TABLE carts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token varchar(64),                 -- guest carts, web only
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  address_id    uuid REFERENCES addresses(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR session_token IS NOT NULL)
);
CREATE UNIQUE INDEX ON carts (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE cart_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id       uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  menu_item_id  uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity      smallint NOT NULL CHECK (quantity > 0),
  note          varchar(160),                -- 'No pepper please'
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_item_options (
  cart_item_id  uuid NOT NULL REFERENCES cart_items(id) ON DELETE CASCADE,
  option_id     uuid NOT NULL REFERENCES menu_item_options(id) ON DELETE CASCADE,
  PRIMARY KEY (cart_item_id, option_id)
);

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'awaiting_restaurant',   -- 3-minute accept window
  'cooking',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
  'rejected'
);

CREATE TYPE payment_method AS ENUM ('card', 'transfer', 'cash');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

CREATE TABLE orders (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               integer NOT NULL UNIQUE,        -- human-facing, e.g. 1042
  public_token       varchar(24) NOT NULL UNIQUE,    -- for /t/1042-x9k tracking links
  user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  restaurant_id      uuid NOT NULL REFERENCES restaurants(id),
  rider_id           uuid REFERENCES users(id) ON DELETE SET NULL,

  -- address is SNAPSHOTTED, not referenced. It must not change after ordering.
  address_landmark   varchar(200) NOT NULL,
  address_note       varchar(200),
  address_area_id    uuid REFERENCES areas(id),
  address_lat        double precision,
  address_lng        double precision,
  customer_phone     varchar(20) NOT NULL,
  customer_name      varchar(80),

  status             order_status NOT NULL DEFAULT 'pending_payment',
  status_reason      varchar(160),                   -- 'A dish has finished'

  -- money, all kobo
  subtotal_kobo      integer NOT NULL,
  delivery_fee_kobo  integer NOT NULL,
  discount_kobo      integer NOT NULL DEFAULT 0,
  tip_kobo           integer NOT NULL DEFAULT 0,
  total_kobo         integer NOT NULL,
  commission_kobo    integer NOT NULL,               -- what Karrigo keeps
  restaurant_payout_kobo integer NOT NULL,
  rider_payout_kobo  integer NOT NULL,

  payment_method     payment_method NOT NULL,
  payment_status     payment_status NOT NULL DEFAULT 'pending',
  payment_reference  varchar(120),                   -- Paystack ref
  promo_code         varchar(40),

  distance_km        numeric(4,1),
  prep_minutes       smallint,                       -- chosen by the restaurant
  eta_at             timestamptz,

  placed_at          timestamptz NOT NULL DEFAULT now(),
  accepted_at        timestamptz,
  ready_at           timestamptz,
  picked_up_at       timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz
);
CREATE INDEX ON orders (restaurant_id, status);
CREATE INDEX ON orders (user_id, placed_at DESC);
CREATE INDEX ON orders (status) WHERE status IN ('awaiting_restaurant','cooking','ready','picked_up');

-- Line items are SNAPSHOTS. Prices and names must not change retroactively.
CREATE TABLE order_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  name          varchar(120) NOT NULL,          -- snapshot
  unit_price_kobo integer NOT NULL,             -- snapshot
  quantity      smallint NOT NULL,
  options_json  jsonb NOT NULL DEFAULT '[]',    -- snapshot of chosen options
  note          varchar(160),
  line_total_kobo integer NOT NULL
);

CREATE TABLE order_events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      order_status NOT NULL,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_kind  varchar(20),                      -- customer|restaurant|rider|system
  note        varchar(200),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON order_events (order_id, created_at);

-- Live rider position for the tracking map.
CREATE TABLE rider_locations (
  rider_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- RATINGS, REFUNDS, PAYOUTS
-- ============================================================================

CREATE TABLE ratings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  subject       varchar(12) NOT NULL,          -- 'restaurant' | 'rider'
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  rider_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  stars         smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags          text[] NOT NULL DEFAULT '{}',  -- 'Tasted great', 'Still hot'
  comment       varchar(500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, subject)
);

CREATE TABLE refunds (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid NOT NULL REFERENCES orders(id),
  amount_kobo   integer NOT NULL,
  reason        varchar(200) NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'pending',
  provider_ref  varchar(120),
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  settled_at    timestamptz
);

CREATE TABLE payouts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payee_kind    varchar(12) NOT NULL,          -- 'restaurant' | 'rider'
  restaurant_id uuid REFERENCES restaurants(id),
  rider_id      uuid REFERENCES users(id),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  gross_kobo    integer NOT NULL,
  commission_kobo integer NOT NULL DEFAULT 0,
  refunds_kobo  integer NOT NULL DEFAULT 0,
  net_kobo      integer NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'pending',
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payout_lines (
  payout_id  uuid NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  order_id   uuid NOT NULL REFERENCES orders(id),
  amount_kobo integer NOT NULL,
  PRIMARY KEY (payout_id, order_id)
);

-- ============================================================================
-- PROMOS & SUGGESTIONS
-- ============================================================================

CREATE TABLE promo_codes (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           varchar(40) NOT NULL UNIQUE,
  percent_off    smallint,
  amount_off_kobo integer,
  max_discount_kobo integer,
  min_order_kobo integer NOT NULL DEFAULT 0,
  first_order_only boolean NOT NULL DEFAULT false,
  uses_total     integer,
  uses_per_user  smallint NOT NULL DEFAULT 1,
  starts_at      timestamptz,
  ends_at        timestamptz,
  active         boolean NOT NULL DEFAULT true
);

CREATE TABLE promo_redemptions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_id   uuid NOT NULL REFERENCES promo_codes(id),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  order_id   uuid NOT NULL REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SEED HINTS
-- ============================================================================
-- Areas:      High Level, Wurukum, North Bank, Modern Market,
--             Judges Quarters, Ankpa Ward, BSU and around
-- Fee bands:  ≤1km ₦500/₦450 · ≤3km ₦800/₦650 · ≤5km ₦1,100/₦900
-- Restaurants: Terkimbi's Kitchen, Sewuese Rice Spot, Modern Market Suya,
--             Aondona Breakfast, Benue Grills, Ankpa Bukka
-- NOTE: all restaurant names, prices and fee bands above are PLACEHOLDERS from
-- the design. Replace with real onboarded data before launch.
