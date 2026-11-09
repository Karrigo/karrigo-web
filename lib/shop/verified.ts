/**
 * The "verified" label on public kitchen and store payloads. Older or cached
 * responses omit it, so anything but a literal `true` reads as not verified.
 */
export function isVerified(value: unknown): boolean {
  return value === true;
}

/** The accessible name of the badge: says what is verified. */
export function verifiedLabel(vendor: "kitchen" | "store"): string {
  return vendor === "store" ? "Verified store" : "Verified kitchen";
}
