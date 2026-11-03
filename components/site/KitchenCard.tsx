import Image from "next/image";
import type { Kitchen } from "@/lib/fixtures";
import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";

export function KitchenCard({
  kitchen,
  priority = false,
  fromKobo,
}: {
  kitchen: Kitchen;
  priority?: boolean;
  /** The ordering flow shows a starting price; the marketing page does not. */
  fromKobo?: number;
}) {
  const shut = Boolean(kitchen.closedUntil);

  return (
    <div
      className={cn("bg-bg rounded-panel-sm overflow-hidden block", shut && "opacity-45")}
    >
      <div className="bg-surface-raised relative aspect-[4/3] overflow-hidden">
        <Image
          src={kitchen.image}
          alt={`${kitchen.cuisine} from ${kitchen.name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 350px"
          priority={priority}
          className="object-cover"
        />
        {shut ? (
          <span className="bg-danger text-bg absolute top-sm left-sm rounded-pill px-md py-xs text-eyebrow normal-case">
            {kitchen.closedUntil}
          </span>
        ) : kitchen.deliveryFeeKobo === 0 ? (
          <span className="bg-accent text-on-accent absolute top-sm left-sm rounded-pill px-md py-xs text-eyebrow normal-case">
            Free delivery
          </span>
        ) : kitchen.opensAt ? (
          <span className="bg-accent-warm text-bg absolute top-sm left-sm rounded-pill px-md py-xs text-eyebrow normal-case">
            {kitchen.opensAt}
          </span>
        ) : null}
      </div>

      <div className="px-lg pt-xl pb-lg">
        <div className="text-site-title">{kitchen.name}</div>
        <div className="text-site-label text-text-secondary mt-xs">
          {kitchen.cuisine} · {kitchen.area}
        </div>

        {!shut && (
          <div className="mt-md gap-xs text-site-chip flex flex-wrap">
            <span className="bg-surface rounded-pill px-md py-xs">
              {kitchen.distanceKm} km
            </span>
            <span className="bg-surface rounded-pill px-md py-xs">
              {kitchen.etaMinutes[0]}–{kitchen.etaMinutes[1]} min
            </span>
            {fromKobo !== undefined && (
              <span className="bg-surface rounded-pill px-md py-xs">
                from {formatKobo(fromKobo)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
