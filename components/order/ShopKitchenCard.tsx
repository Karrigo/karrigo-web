import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import { placeHref } from "@/lib/shop/paths";
import type { ShopKitchen, Side } from "@/lib/shop/types";

import { VerifiedBadge } from "./VerifiedBadge";

/** A kitchen in the grid. A closed kitchen stays visible, dimmed and labelled,
 *  because "where did Terkimbi's go?" is worse than "closed until 11". */
export function ShopKitchenCard({
  kitchen,
  side = "FOOD",
  priority = false,
}: {
  kitchen: ShopKitchen;
  side?: Side;
  priority?: boolean;
}) {
  const shut = !kitchen.open;

  return (
    <Link
      href={placeHref(kitchen.slug, side, kitchen.vendor)}
      className={cn(
        "bg-bg rounded-panel-sm overflow-hidden group block transition-[transform,box-shadow] duration-(--duration-normal)",
        shut ? "opacity-55" : "hover:-translate-y-1.5 hover:shadow-card",
      )}
    >
      <div className="bg-surface-raised relative grid aspect-[4/3] place-items-center overflow-hidden">
        {kitchen.imageUrl ? (
          <Image
            src={kitchen.imageUrl}
            alt={`${kitchen.cuisine} from ${kitchen.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 350px"
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-(--duration-slow)",
              !shut && "group-hover:scale-[1.03]",
            )}
          />
        ) : (
          <span aria-hidden className="text-[64px]">
            {kitchen.emoji ?? (side === "GROCERY" ? "🛒" : "🍲")}
          </span>
        )}
        {shut ? (
          <span className="bg-danger text-bg absolute top-sm left-sm rounded-pill px-md py-xs text-eyebrow normal-case">
            {kitchen.notice ?? "Closed right now"}
          </span>
        ) : null}
      </div>

      <div className="px-lg pt-xl pb-lg">
        <div className="gap-sm flex items-center">
          <div className="text-site-title min-w-0 truncate">{kitchen.name}</div>
          {kitchen.verified ? <VerifiedBadge vendor={kitchen.vendor} compact /> : null}
        </div>
        <div className="text-site-label text-text-secondary mt-xs">
          {kitchen.cuisine} · {kitchen.area}
        </div>
        {!shut && (
          <div className="text-site-chip text-text-secondary mt-md flex flex-wrap gap-x-md gap-y-xs font-semibold">
            {kitchen.ratingsCount > 0 && (
              <span>
                ★ {kitchen.rating.toFixed(1)} ({kitchen.ratingsCount})
              </span>
            )}
            <span>Delivery from {formatKobo(kitchen.deliveryFromKobo)}</span>
            {side === "GROCERY" && kitchen.minOrderKobo ? <span>Min. {formatKobo(kitchen.minOrderKobo)}</span> : null}
          </div>
        )}
      </div>
    </Link>
  );
}
