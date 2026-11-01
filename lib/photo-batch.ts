/**
 * Multi-photo picks for the verification-photo sets (kitchens and stores
 * both need exactly 6). The native picker takes any number of files at
 * once, so this plans the batch: how many of the picked files actually
 * get uploaded, and how many are left out because the set is full.
 * Pure so bun can cover it without a browser.
 */
export function planPhotoBatch(
  picked: number,
  existing: number,
  required: number,
): { take: number; skipped: number } {
  const room = Math.max(0, required - existing);
  const take = Math.min(Math.max(0, picked), room);
  return { take, skipped: Math.max(0, picked) - take };
}
