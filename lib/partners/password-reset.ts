/**
 * Forgotten passwords for kitchens and stores. They share one login, so the
 * reset is the same call on either side; only the endpoint prefix differs.
 */

export type PartnerResetSide = "kitchen" | "store";

export const PARTNER_PASSWORD_MIN = 8;
export const PARTNER_PASSWORD_MAX = 72;

export function resetPath(side: PartnerResetSide, step: "forgot" | "reset"): string {
  return `/${side}-auth/password/${step}`;
}

/** The first thing wrong with a reset, as a sentence, or null when it is fine. */
export function resetInputIssue(input: { email: string; code?: string; password?: string }): string | null {
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) return "Enter the email you log in with.";
  if (input.code !== undefined && !/^\d{6}$/.test(input.code)) return "Enter the 6-digit code we emailed you.";
  if (input.password !== undefined) {
    if (input.password.length < PARTNER_PASSWORD_MIN) return `Password needs at least ${PARTNER_PASSWORD_MIN} characters.`;
    if (input.password.length > PARTNER_PASSWORD_MAX) return `Password can be at most ${PARTNER_PASSWORD_MAX} characters.`;
  }
  return null;
}

type ResetError = { status: number; message: string; body: Record<string, unknown> };

/** What the backend's answers to a reset mean to the person at the screen. */
export function resetFailureMessage(error: ResetError): string | null {
  if (error.status === 429) {
    const wait = error.body.retryAfterSeconds;
    return typeof wait === "number"
      ? `Too many tries. Wait ${wait < 90 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`} and try again.`
      : "Too many tries. Wait a little and try again.";
  }
  if (error.status === 401 || error.status === 400) {
    if (/expired/i.test(error.message)) return "That code has expired. Ask for a new one.";
    const left = error.body.attemptsRemaining;
    if (typeof left === "number") {
      return left > 0
        ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "That code is used up. Ask for a new one.";
    }
    if (error.status === 401) return "That code didn't work, or it has expired. Check it or ask for a new one.";
  }
  return null;
}
