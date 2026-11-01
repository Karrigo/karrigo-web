/**
 * The ops domain. These types describe what a dispatcher in Makurdi looks at
 * during a shift; they are deliberately independent of the customer app's
 * types, because ops sees things a customer never does — cash held by a rider,
 * a kitchen's payout balance, why an application was rejected.
 *
 * Money is kobo, always integers (CLAUDE.md rule 4).
 */

/* ---------------------------------------------------------------- orders */

/** The six states an order moves through, in order. The index matters: the
 *  timeline renders them in sequence and "how far along" is a comparison. */
export const ORDER_STAGES = [
  "waiting",
  "awaiting_payment",
  "accepted",
  "cooking",
  "ready",
  "on_the_way",
  "delivered",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export const STAGE_LABEL: Record<OrderStage, string> = {
  waiting: "Waiting for kitchen",
  awaiting_payment: "Awaiting payment",
  accepted: "Accepted",
  cooking: "Cooking",
  ready: "Ready",
  on_the_way: "On the way",
  delivered: "Delivered",
};

/** Why a cancelled order was cancelled. The customer is never charged in any
 *  of these cases (SYNC_WEB_ADMIN.md §2). */
export const CANCEL_REASON_LABEL: Record<"CUSTOMER" | "KITCHENS_DECLINED" | "STORE_DECLINED" | "PAYMENT_EXPIRED" | "KITCHEN_TIMEOUT", string> = {
  CUSTOMER: "Cancelled by the customer",
  KITCHENS_DECLINED: "Every kitchen declined",
  STORE_DECLINED: "The store declined",
  PAYMENT_EXPIRED: "Not paid in time",
  KITCHEN_TIMEOUT: "No kitchen answered in time",
};

export type PaymentMethod = "card" | "transfer" | "ussd" | "online" | "cash";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  card: "Card",
  transfer: "Bank transfer",
  ussd: "USSD",
  online: "Paid online",
  cash: "Cash on delivery",
};

/* ------------------------------------------------------- kitchens, riders */

export type KitchenStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type RiderStatus = "PENDING" | "APPROVED" | "REJECTED";

/* --------------------------------------------------------------- tickets */

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export type Ticket = {
  id: string;
  subject: string;
  body: string;
  fromType: "Customer" | "Rider" | "Kitchen";
  fromName: string;
  channel: "IN_APP" | "WHATSAPP";
  /** The order it is about, when there is one. */
  orderId: string | null;
  status: TicketStatus;
  /** "8 min ago", "Yesterday". */
  age: string;
  /** International format, for the WhatsApp deep link. */
  phone: string;
};

/* -------------------------------------------------------------- overview */

/* ----------------------------------------------------------------- staff */

/** Moderators run the shift: orders, approvals, tickets. Only a super admin
 *  moves money — payouts and refunds. Enforced server-side, never by hiding
 *  the button alone. */
export type AdminRole = "SUPER_ADMIN" | "MODERATOR";

export type AdminUser = {
  name: string;
  email: string;
  role: AdminRole;
  /** Two letters for the sidebar avatar. */
  initials: string;
};
