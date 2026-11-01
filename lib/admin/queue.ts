/**
 * Kitchens and riders are the same job: someone applied, ops checks their
 * paperwork, approves or rejects them with a reason, and later settles what
 * they are owed. One shape describes both, so there is one review screen and
 * one set of rules about what can be done from which state.
 */

import type { Schemas } from "@/lib/api/types";
import { formatKobo, nairaToKobo } from "@/lib/money";
import { whenLabel } from "./format";
import type { KitchenStatus, RiderStatus } from "./types";

export type QueueKind = "kitchens" | "riders" | "stores";
export type QueueStatus = KitchenStatus | RiderStatus;

export type QueueCheck = {
  label: string;
  ok: boolean;
  /** An uploaded file ops can open, rather than a fact we hold. Names which
   *  one, so the viewer can ask for just that signed URL. `guarantor` is not
   *  a file — it opens from `QueueItem.guarantor`, already in hand. */
  document?: "license" | "id" | "vehicleReg" | "guarantor";
};

export type QueueItem = {
  id: string;
  title: string;
  /** The one line under the name on the row. */
  sub: string;
  status: QueueStatus;
  when: string;
  /** ISO, for ordering — the queue is oldest first. */
  createdAt: string;
  /** Why they were rejected or suspended. They see this. */
  note: string | null;
  /** A suspended kitchen's or store's open appeal to ops, if it has one. */
  appeal: { note: string; at: string } | null;
  /** Ops' answer to an earlier appeal that was declined; the owner may appeal again. */
  appealResponse: { note: string; at: string } | null;
  /** Kitchen or store that no admin has ever approved: SUSPENDED then means "rejected", not "banned". */
  neverApproved: boolean;
  /** Ops has asked for the CAC certificate before approval. Kitchens and stores only. */
  requiresCac: boolean;
  fields: { key: string; value: string }[];
  checks: QueueCheck[];
  /** Owed to them, before anything is netted off. */
  unpaidKobo: number;
  /** What a payout would send, as the backend computes it — never worked out
   *  here, so this screen cannot disagree with the transfer. */
  netKobo: number;
  /** Rider only: cash they already hold from cash-on-delivery orders. */
  cashHeldKobo: number;
  /** False when there is no confirmed bank account to send to. */
  payable: boolean;
  /** Rider only: the guarantor's form, read straight off the rider record —
   *  there is no signed URL for it, it isn't a file (SYNC_WEB_ADMIN.md §1b). */
  guarantor?: { name: string; phone: string; address: string } | null;
};

/** What actually leaves our account. A rider has already been paid part of
 *  what they are owed, in cash, by customers at the gate. */
export function payoutKobo(item: QueueItem): number {
  return item.netKobo;
}

export const QUEUE_TABS: Record<QueueKind, { status: QueueStatus; label: string }[]> =
  {
    kitchens: [
      { status: "PENDING", label: "Waiting for approval" },
      { status: "ACTIVE", label: "Live" },
      { status: "SUSPENDED", label: "Suspended" },
    ],
    riders: [
      { status: "PENDING", label: "Waiting for review" },
      { status: "APPROVED", label: "Approved" },
      { status: "REJECTED", label: "Rejected" },
    ],
    stores: [
      { status: "PENDING", label: "Waiting for approval" },
      { status: "ACTIVE", label: "Live" },
      { status: "SUSPENDED", label: "Suspended" },
    ],
  };

/** What to call a status for this item. A SUSPENDED application nobody ever approved was rejected, not banned. */
export function queueStatusLabel(item: Pick<QueueItem, "status" | "neverApproved">): string {
  return item.status === "SUSPENDED" && item.neverApproved ? "Rejected" : QUEUE_STATUS_LABEL[item.status];
}

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Live",
  SUSPENDED: "Suspended",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function kitchenItem(
  kitchen: Schemas["KitchenResponseDto"],
  due?: Schemas["KitchenPayoutDueDto"],
): QueueItem {
  const netKobo = due ? nairaToKobo(due.netNaira) : 0;
  const area = kitchen.area ?? "—";
  const cuisine = kitchen.cuisine ?? "—";
  return {
    id: kitchen.id,
    title: kitchen.name,
    sub: `${area} · ${cuisine}`,
    status: kitchen.status,
    when: whenLabel(kitchen.createdAt),
    createdAt: kitchen.createdAt,
    note: kitchen.rejectionNote ?? null,
    appeal: kitchen.appealedAt
      ? { note: kitchen.appealNote ?? "", at: whenLabel(String(kitchen.appealedAt)) }
      : null,
    appealResponse: kitchen.appealResponse
      ? { note: kitchen.appealResponse, at: kitchen.appealRespondedAt ? whenLabel(String(kitchen.appealRespondedAt)) : "" }
      : null,
    neverApproved: !kitchen.firstApprovedAt,
    requiresCac: kitchen.requiresCac,
    fields: [
      { key: "Area", value: area },
      { key: "Cuisine", value: cuisine },
      { key: "Signed up", value: whenLabel(kitchen.createdAt) },
      // Never the legacy feeNaira (0 for new kitchens). Delivery = max(this,
      // distance x per-km), so this is the floor a customer pays.
      {
        key: "Rider base fee",
        value: kitchen.riderBaseFeeNaira != null ? formatKobo(nairaToKobo(kitchen.riderBaseFeeNaira)) : "Not set",
      },
      {
        key: "Sells",
        value:
          kitchen.servesFood && kitchen.servesGrocery
            ? "Food and groceries"
            : kitchen.servesGrocery
              ? "Groceries"
              : "Food",
      },
    ],
    checks: [
      { label: "Location pinned on the map", ok: kitchen.lat != null && kitchen.lng != null },
      { label: "Rider fee set", ok: kitchen.riderBaseFeeNaira != null },
      { label: "Payout bank account confirmed", ok: !!kitchen.payoutAccountName },
    ],
    unpaidKobo: netKobo,
    netKobo,
    cashHeldKobo: 0,
    payable: !!due?.hasPayoutAccount,
  };
}

export function riderItem(
  rider: Schemas["AdminRiderListItemDto"],
  due?: Schemas["RiderPayoutDueDto"],
): QueueItem {
  const vehicle = rider.vehicleType ?? "—";
  const plate = rider.plateNumber ?? "—";
  return {
    id: rider.id,
    title: rider.user.name ?? rider.user.phone,
    sub: `${vehicle} · ${plate}`,
    status: rider.verificationStatus,
    when: whenLabel(rider.documentsSubmittedAt ?? rider.createdAt),
    createdAt: rider.documentsSubmittedAt ?? rider.createdAt,
    note: rider.rejectionNote ?? null,
    appeal: null,
    appealResponse: null,
    neverApproved: false,
    requiresCac: false,
    fields: [
      { key: "Phone", value: rider.user.phone },
      { key: "Vehicle", value: vehicle },
      { key: "Plate", value: plate },
      { key: "Applied", value: whenLabel(rider.documentsSubmittedAt ?? rider.createdAt) },
    ],
    checks: [
      { label: "Driver's licence", ok: !!rider.licenseDocUrl, document: "license" },
      { label: "Government ID", ok: !!rider.idDocUrl, document: "id" },
      { label: "Vehicle papers", ok: !!rider.vehicleRegDocUrl, document: "vehicleReg" },
      { label: "Guarantor's form", ok: !!rider.guarantorName, document: "guarantor" },
      { label: "Payout bank account", ok: !!rider.payoutAccountName },
    ],
    unpaidKobo: due ? nairaToKobo(due.earnedNaira + due.waitPayNaira) : 0,
    netKobo: due ? nairaToKobo(due.netNaira) : 0,
    cashHeldKobo: due ? nairaToKobo(due.cashHeldNaira) : 0,
    payable: !!due?.hasPayoutAccount,
    guarantor: rider.guarantorName
      ? {
          name: rider.guarantorName,
          phone: rider.guarantorPhone ?? "—",
          address: rider.guarantorAddress ?? "—",
        }
      : null,
  };
}

export function storeItem(
  store: Schemas["StoreResponseDto"],
  detail: Schemas["AdminStoreDetailDto"],
): QueueItem {
  const area = store.area ?? "—";
  const owners = detail.staff.filter((member) => member.staffRole === "OWNER");
  const ownerNames = (owners.length ? owners : detail.staff).map((member) => member.name).join(", ") || "—";
  const payout = store.payoutAccountName
    ? `${store.payoutAccountName} · •••• ${store.payoutAccountNumber?.slice(-4) ?? "—"}`
    : "Not set";

  return {
    id: store.id,
    title: store.name,
    sub: `${area} · ${detail.business.name}`,
    status: store.status,
    when: whenLabel(store.createdAt),
    createdAt: store.createdAt,
    note: store.rejectionNote,
    appeal: store.appealedAt
      ? { note: store.appealNote ?? "", at: whenLabel(store.appealedAt) }
      : null,
    appealResponse: store.appealResponse
      ? { note: store.appealResponse, at: store.appealRespondedAt ? whenLabel(store.appealRespondedAt) : "" }
      : null,
    neverApproved: !store.firstApprovedAt,
    requiresCac: store.requiresCac,
    fields: [
      { key: "Area", value: area },
      { key: "Owner", value: ownerNames },
      { key: "Payout account", value: payout },
      {
        key: "Same-business kitchen",
        value: detail.kitchen ? `${detail.kitchen.name} · ${detail.kitchen.status}` : "None",
      },
      { key: "Signed up", value: whenLabel(store.createdAt) },
    ],
    checks: [
      { label: "Location pinned on the map", ok: store.lat != null && store.lng != null },
      { label: "Rider fee set", ok: store.riderBaseFeeNaira != null },
      { label: "Payout bank account confirmed", ok: !!store.payoutAccountName },
      {
        label: `${detail.verificationPhotos.length} of 6 store photos`,
        ok: detail.verificationPhotos.length >= 6,
      },
    ],
    unpaidKobo: 0,
    netKobo: 0,
    cashHeldKobo: 0,
    payable: false,
  };
}

/** The money line added to the detail panel once there is a balance. */
export function balanceFields(
  kind: QueueKind,
  item: QueueItem,
): { key: string; value: string }[] {
  if (kind === "stores" || !item.unpaidKobo) return [];
  if (kind === "kitchens") {
    return [
      { key: "Unpaid sales (after commission)", value: formatKobo(item.unpaidKobo) },
    ];
  }
  return [
    { key: "Unpaid trip pay", value: formatKobo(item.unpaidKobo) },
    { key: "Cash held from COD", value: formatKobo(item.cashHeldKobo) },
  ];
}
