"use client";

import { useState } from "react";

import { flagProduct, kitchenProducts, type KitchenProduct } from "@/app/(admin)/admin/moderation-actions";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Eyebrow } from "@/components/admin/ui";
import { formatKobo } from "@/lib/money";

/**
 * A kitchen's products, so ops can hide one that shouldn't be on sale. Opened
 * on demand: the list comes from the public menu, so it is only fetched when
 * someone asks for it. Flagging needs a note the owner will read.
 */
export function KitchenProducts({ kitchenId }: { kitchenId: string }) {
  const [state, setState] = useState<
    { kitchenId: string; products: KitchenProduct[] } | { kitchenId: string; error: string } | "loading" | null
  >(null);
  const [filter, setFilter] = useState("");

  const current = state && state !== "loading" && state.kitchenId === kitchenId ? state : null;

  async function open() {
    setState("loading");
    const result = await kitchenProducts(kitchenId);
    setState(result.ok ? { kitchenId, products: result.products } : { kitchenId, error: result.error });
  }

  const products = current && "products" in current ? current.products : [];
  const shown = products.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 40);

  return (
    <div className="border-text/8 flex flex-col gap-2.5 border-b px-[22px] py-lg">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow className="text-[10.5px]">Products on sale</Eyebrow>
        {!current && (
          <button
            type="button"
            disabled={state === "loading"}
            onClick={open}
            className="text-accent-text text-[12px] font-semibold disabled:opacity-50"
          >
            {state === "loading" ? "Loading…" : "Show products"}
          </button>
        )}
      </div>

      {current && "error" in current && <p className="text-danger text-[12.5px]">{current.error}</p>}

      {current && "products" in current && (
        <>
          {products.length === 0 ? (
            <p className="text-text/62 text-[12.5px]">Nothing is on sale right now.</p>
          ) : (
            <>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Search ${products.length} products`}
                aria-label="Search products"
                className="border-text/16 bg-ops-surface text-text placeholder:text-text/45 rounded-xl border px-3 py-2 text-[12.5px] outline-none"
              />
              <ul className="flex flex-col gap-3">
                {shown.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[13px] font-semibold">
                        {p.name}
                        {p.unit && <span className="text-text/62 font-normal"> · {p.unit}</span>}
                      </span>
                      <span className="text-text/62 shrink-0 text-[12px]">
                        {p.section} · {formatKobo(p.priceKobo)}
                      </span>
                    </div>
                    <ConfirmAction
                      size="sm"
                      tone="bad"
                      label="Flag"
                      title={`Flag ${p.name}?`}
                      text="It's hidden from customers and can't be ordered until you clear the flag. The owner sees your note and can appeal."
                      confirm="Flag product"
                      note={{ placeholder: "Why? (required) · the owner sees this", required: true }}
                      run={async (note) => {
                        const result = await flagProduct(p.id, note);
                        if (result.ok) setState({ kitchenId, products: products.filter((x) => x.id !== p.id) });
                        return result;
                      }}
                    />
                  </li>
                ))}
              </ul>
              {products.length > shown.length && !filter && (
                <p className="text-text/62 text-[12px]">Showing the first {shown.length}. Search to find the rest.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
