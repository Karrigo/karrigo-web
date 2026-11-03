import Image from "next/image";
import type { Store } from "@/lib/fixtures";
import { formatKobo } from "@/lib/money";

export function StoreCard({
  store,
  priority = false,
}: {
  store: Store;
  priority?: boolean;
}) {
  return (
    <div className="bg-bg rounded-panel-sm overflow-hidden block">
      <div className="bg-surface-raised relative aspect-[4/3] overflow-hidden">
        <Image
          src={store.image}
          alt={`${store.category} at ${store.name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 350px"
          priority={priority}
          className="object-cover"
        />
      </div>

      <div className="px-lg pt-xl pb-lg">
        <div className="text-site-title">{store.name}</div>
        <div className="text-site-label text-text-secondary mt-xs">
          {store.category} · {store.area}
        </div>

        <div className="mt-md gap-xs text-site-chip flex flex-wrap">
          <span className="bg-surface rounded-pill px-md py-xs">
            {store.etaMinutes[0]}–{store.etaMinutes[1]} min
          </span>
          {store.deliveryFeeKobo !== undefined && (
            <span className="bg-surface rounded-pill px-md py-xs">
              {formatKobo(store.deliveryFeeKobo)} delivery
            </span>
          )}
          {store.minOrderKobo !== undefined && (
            <span className="bg-surface rounded-pill px-md py-xs">
              Min {formatKobo(store.minOrderKobo)}
            </span>
          )}
          {store.closesAt && (
            <span className="bg-surface rounded-pill px-md py-xs">
              {store.closesAt}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
