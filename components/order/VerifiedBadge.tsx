import { cn } from "@/lib/cn";
import { verifiedLabel } from "@/lib/shop/verified";
import type { Vendor } from "@/lib/shop/types";

/** The seal on a kitchen or store Karrigo has verified. The check shape and the
 *  word "Verified" carry the meaning, not the colour alone; the label names
 *  what is verified. `compact` drops the word for tight card rows (the icon
 *  keeps the accessible name). */
export function VerifiedBadge({
  vendor,
  compact = false,
  className,
}: {
  vendor: Vendor;
  compact?: boolean;
  className?: string;
}) {
  const label = verifiedLabel(vendor);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("text-success text-site-chip inline-flex shrink-0 items-center gap-xs font-semibold", className)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none">
        <path
          d="M8 1l1.8 1.3 2.2-.1.7 2.1 1.8 1.3-.7 2.1.7 2.1-1.8 1.3-.7 2.1-2.2-.1L8 15l-1.8-1.3-2.2.1-.7-2.1L1.5 10.4l.7-2.1-.7-2.1L3.3 4.9 4 2.8l2.2.1L8 1z"
          fill="currentColor"
        />
        <path d="M5.3 8.2l1.8 1.8 3.6-3.8" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {compact ? null : <span aria-hidden>Verified</span>}
    </span>
  );
}
