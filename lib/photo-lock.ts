/**
 * Which photo UI a vendor sees. The set only locks once the business is
 * APPROVED — before that the owner edits freely. An approved update request
 * with an unexpired unlock window re-opens editing; once it lapses (or a
 * request is rejected) the set locks again. Pure so bun can cover it without
 * a browser; mirrors the partner app's photo-update helper.
 */
export type PhotoUpdateRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PhotoUpdateRequest = {
  id: string;
  status: PhotoUpdateRequestStatus;
  reason: string;
  unlockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

export type PhotoLockState = "editable" | "locked" | "pending" | "unlocked";

export function photoLockState(
  vendorStatus: string | undefined,
  request: PhotoUpdateRequest,
  nowMs: number = Date.now(),
): PhotoLockState {
  if (vendorStatus !== "ACTIVE") return "editable";
  const unlockedMs = request?.unlockedUntil ? Date.parse(request.unlockedUntil) : Number.NaN;
  if (Number.isFinite(unlockedMs) && unlockedMs > nowMs) return "unlocked";
  if (request?.status === "PENDING") return "pending";
  return "locked";
}
