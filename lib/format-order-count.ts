/**
 * The "N orders" label on kitchen and store cards. Shown only from 10 up:
 * exact under 100, rounded down to 10s ("120+") under 1000, then to 100s
 * ("1200+"). Older or cached API responses omit the count, so anything that
 * is not a finite non-negative number reads as no count.
 */
export function formatOrderCount(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 10) return null;
  const whole = Math.floor(n);
  if (whole < 100) return `${whole} orders`;
  if (whole < 1000) return `${Math.floor(whole / 10) * 10}+ orders`;
  return `${Math.floor(whole / 100) * 100}+ orders`;
}
