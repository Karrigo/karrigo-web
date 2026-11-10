"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eyebrow } from "@/components/site/Eyebrow";
import { setDelivery } from "@/lib/order/store";
import type { ShopKitchen, Side } from "@/lib/shop/types";
import { cn } from "@/lib/cn";
import { CategoryChips } from "./CategoryChips";
import { ShopKitchenCard } from "./ShopKitchenCard";

/** Spelled out so Tailwind sees each class name. */
const stagger = ["rise-1", "rise-2", "rise-3", "rise-4", "rise-5", "rise-6"];

/** The homepage's address form lands here with ?address=. Keep it as the
 *  landmark so checkout and the header already know where the food goes. */
function AddressFromQuery() {
  const address = useSearchParams().get("address")?.trim();
  useEffect(() => {
    if (address) setDelivery({ landmark: address });
  }, [address]);
  return null;
}

/**
 * Search and cuisine chips over the kitchen grid. Search matches kitchen
 * names, cuisines and areas. (Dish search will follow once the backend has a
 * search endpoint — the list does not carry menus.)
 */
export function KitchensBrowser({
  kitchens,
  firstName,
  side = "FOOD",
  categories = null,
  categoryId,
  loadFailed = false,
}: {
  kitchens: ShopKitchen[];
  firstName: string | null;
  /** Active categories for this side; null when they could not be loaded, which hides the chips. */
  categories?: { id: string; name: string }[] | null;
  /** The category the list was fetched for, if any. */
  categoryId?: string;
  /** The filtered list could not be fetched, so an empty list means nothing. */
  loadFailed?: boolean;
  side?: Side;
}) {
  const stores = side === "GROCERY";
  const noun = stores ? "store" : "kitchen";
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("All");

  const categoryName = categories?.find((c) => c.id === categoryId)?.name;
  const cuisines = ["All", ...new Set(kitchens.map((k) => k.cuisine))];
  // The list changes under a category switch; a cuisine that is gone falls back to All.
  const activeCuisine = cuisines.includes(cuisine) ? cuisine : "All";
  const q = query.trim().toLowerCase();
  const shown = kitchens.filter(
    (k) =>
      (activeCuisine === "All" || k.cuisine === activeCuisine) &&
      (!q || [k.name, k.cuisine, k.area].join(" ").toLowerCase().includes(q)),
  );
  const openNow = shown.filter((k) => k.open);
  const closed = shown.filter((k) => !k.open);

  return (
    <div className="mx-auto max-w-[1240px]">
      <Suspense fallback={null}>
        <AddressFromQuery />
      </Suspense>
      <div className="gap-lg flex flex-wrap items-end justify-between">
        <div>
          <Eyebrow className="rise">{firstName ? `Hi ${firstName} · open right now` : "Open right now"}</Eyebrow>
          <h1 className="text-section-small md:text-section rise rise-1 mt-md">{stores ? "Stores near you" : "Kitchens near you"}</h1>
        </div>

        <label className="bg-bg rounded-pill gap-sm flex min-w-[240px] flex-[0_1_380px] items-center py-xs pr-xs pl-lg">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="stroke-text-tertiary size-[16px] shrink-0 fill-none stroke-[2.4]"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="sr-only">Search {noun}s</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search a ${noun} or area`}
            className="text-site-body placeholder:text-text-secondary min-w-0 flex-1 bg-transparent py-sm outline-none"
          />
        </label>
      </div>

      {categories && categories.length > 0 && (
        <CategoryChips
          categories={categories}
          selectedId={categoryId}
          label={stores ? "Filter by product category" : "Filter by dish category"}
        />
      )}

      {cuisines.length > 2 && (
        <div className="gap-sm mt-xl flex flex-wrap" role="group" aria-label={stores ? "Filter by type of store" : "Filter by food"}>
          {cuisines.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={activeCuisine === c}
              onClick={() => setCuisine(c)}
              data-theme={activeCuisine === c ? "dark" : undefined}
              className={cn(
                "rounded-pill text-nav-link px-lg py-sm font-bold transition-colors duration-(--duration-fast)",
                activeCuisine === c ? "bg-bg text-accent-text" : "bg-bg text-text hover:bg-surface-raised",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="mt-xxl">
        {loadFailed ? (
          <p role="alert" className="bg-bg rounded-panel-sm text-site-body text-text-secondary p-xxl text-center font-semibold">
            We couldn&rsquo;t load {categoryName ? `${categoryName} ` : ""}{noun}s just now. Refresh to try again, or pick All.
          </p>
        ) : shown.length === 0 ? (
          <p className="bg-bg rounded-panel-sm text-site-body text-text-secondary p-xxl text-center font-semibold">
            {kitchens.length === 0 && categoryName
              ? `No ${noun}s have ${categoryName} right now. Pick All to see every ${noun}.`
              : kitchens.length === 0
              ? `No ${noun}s are taking orders yet. Check back soon — we're opening new ones in your area every week.`
              : q
                ? `No ${noun} matches “${query.trim()}”.`
                : `No ${activeCuisine.toLowerCase()} ${noun}s right now.`}
          </p>
        ) : (
          <>
            {openNow.length > 0 && (
              <div className="gap-xl grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {openNow.map((kitchen, i) => (
                  <div key={kitchen.id} className={cn("rise", stagger[i])}>
                    <ShopKitchenCard kitchen={kitchen} side={side} priority={i < 4} />
                  </div>
                ))}
              </div>
            )}
            {closed.length > 0 && (
              <>
                <h2 className="text-h1 mt-xxl mb-lg font-extrabold">Closed right now</h2>
                <div className="gap-xl grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {closed.map((kitchen) => (
                    <ShopKitchenCard key={kitchen.id} kitchen={kitchen} side={side} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
