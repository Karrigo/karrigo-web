/**
 * Why the backend refused to approve a kitchen or store: a 422
 * `ONBOARDING_INCOMPLETE` whose `details` lists what is still missing. Photos
 * have their own code (VERIFICATION_PHOTOS_REQUIRED) and are handled apart.
 */
export type ApprovalBlocker = "LOCATION" | "RIDER_FEE" | "OWNER_PHOTO" | "PAYOUT_ACCOUNT" | "CAC_DOCUMENT";

const BLOCKER_LABEL: Record<ApprovalBlocker, string> = {
  LOCATION: "a pinned location",
  RIDER_FEE: "a rider fee",
  OWNER_PHOTO: "the owner's photo",
  PAYOUT_ACCOUNT: "a confirmed payout bank account",
  CAC_DOCUMENT: "the CAC certificate",
};

function isBlocker(value: unknown): value is ApprovalBlocker {
  return typeof value === "string" && value in BLOCKER_LABEL;
}

/** The sentence ops sees, or null when this isn't an ONBOARDING_INCOMPLETE answer. An older server (details missing) still gets a plain sentence. */
export function approvalBlockedMessage(noun: "kitchen" | "store", body: { code?: unknown; details?: unknown }): string | null {
  if (body.code !== "ONBOARDING_INCOMPLETE") return null;
  const missing = (Array.isArray(body.details) ? body.details : []).filter(isBlocker).map((b) => BLOCKER_LABEL[b]);
  if (missing.length === 0) return `This ${noun} hasn't finished setting up, so it can't be approved yet.`;
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Can't approve yet. This ${noun} still needs ${list}.`;
}
