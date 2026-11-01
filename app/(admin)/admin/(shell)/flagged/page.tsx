import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { EmptyState, LinkTab, StatusChip } from "@/components/admin/ui";
import { api, type Schemas } from "@/lib/api/client";
import { whenLabel } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/session";
import {
  clearProductFlag,
  clearStoreProductFlag,
  declineProductAppeal,
  declineStoreProductAppeal,
} from "../../moderation-actions";

type Search = { view?: string };

type Row = {
  id: string;
  name: string;
  owner: string;
  flaggedAt: string;
  flagNote: string | null;
  flagAppealNote: string | null;
  flagAppealedAt: string | null;
  clear: (note: string) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  decline: (note: string) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
};

/**
 * Products ops has hidden from customers. A kitchen or store owner can appeal
 * a flag; those come first, because someone is waiting for an answer. Ops can
 * clear the flag (puts the product back on sale and drops the appeal) or
 * decline the appeal with an answer, which leaves it hidden and lets the
 * owner appeal again.
 */
export default async function FlaggedPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const { view = "" } = await searchParams;
  const query = view === "appealed" ? { hasAppeal: true } : {};
  const [items, products] = await Promise.all([
    api<Schemas["FlaggedItemResponseDto"][]>("/admin/flagged-items", { scope: "admin", query }),
    api<Schemas["FlaggedProductResponseDto"][]>("/admin/flagged-products", { scope: "admin", query }),
  ]);
  const rows: Row[] = [
    ...items.map((item) => ({
      id: `item-${item.itemId}`,
      name: item.itemName,
      owner: item.kitchenName,
      flaggedAt: item.flaggedAt,
      flagNote: item.flagNote,
      flagAppealNote: item.flagAppealNote,
      flagAppealedAt: item.flagAppealedAt,
      clear: clearProductFlag.bind(null, item.itemId),
      decline: declineProductAppeal.bind(null, item.itemId),
    })),
    ...products.map((product) => ({
      id: `product-${product.productId}`,
      name: product.productName,
      owner: product.storeName,
      flaggedAt: product.flaggedAt,
      flagNote: product.flagNote,
      flagAppealNote: product.flagAppealNote,
      flagAppealedAt: product.flagAppealedAt,
      clear: clearStoreProductFlag.bind(null, product.productId),
      decline: declineStoreProductAppeal.bind(null, product.productId),
    })),
  ];
  const sorted = rows.sort(
    (a, b) => Number(!!b.flagAppealedAt) - Number(!!a.flagAppealedAt) || b.flaggedAt.localeCompare(a.flaggedAt),
  );

  return (
    <OpsPage>
      <OpsPageHeader
        title="Flagged items"
        meta={`${sorted.length} product${sorted.length === 1 ? "" : "s"} hidden from customers · appeals first`}
      />
      <section className="bg-ops-surface min-w-0 rounded-[15px]">
        <div className="border-text/6 flex flex-wrap items-center gap-2 border-b px-lg py-3.5">
          <LinkTab href="/flagged" label="All" selected={view === ""} />
          <LinkTab href="/flagged?view=appealed" label="Appealed" selected={view === "appealed"} />
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            title={view === "appealed" ? "No appeals waiting" : "Nothing is flagged"}
            text="To flag a product, open its kitchen under Kitchens and choose Show products."
          />
        ) : (
          sorted.map((row) => (
            <div key={row.id} className="border-text/6 flex flex-wrap items-start justify-between gap-3 border-b px-lg py-3.5">
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                <span className="text-text text-[14px] font-semibold">
                  {row.name} · {row.owner}
                  {row.flagAppealedAt && (
                    <span className="ml-2 align-middle">
                      <StatusChip tone="warning">Appealed</StatusChip>
                    </span>
                  )}
                </span>
                {row.flagNote && <p className="text-text/85 text-[13px]/[1.5]">Flagged for: {row.flagNote}</p>}
                {row.flagAppealNote && (
                  <p className="text-text/85 text-[13px]/[1.5]">Owner&rsquo;s appeal: “{row.flagAppealNote}”</p>
                )}
                <span className="text-text/55 text-[12px] font-light">
                  Flagged {whenLabel(row.flaggedAt)}
                  {row.flagAppealedAt ? ` · appealed ${whenLabel(row.flagAppealedAt)}` : ""}
                </span>
              </div>
              <div className="flex max-w-full flex-[0_1_320px] flex-wrap justify-end gap-2">
                {row.flagAppealedAt && (
                  <ConfirmAction
                    size="sm"
                    tone="line"
                    label="Decline appeal"
                    title={`Decline the appeal for ${row.name}?`}
                    text={`It stays hidden. ${row.owner}'s owner is emailed your answer, sees it in the app, and can appeal again.`}
                    confirm="Send answer"
                    note={{ placeholder: "Your answer (required) · the owner reads it", required: true }}
                    run={row.decline}
                  />
                )}
                <ConfirmAction
                  size="sm"
                  tone="go"
                  label="Clear flag"
                  title={`Put ${row.name} back on sale?`}
                  text={`Customers can see and order it from ${row.owner} again.`}
                  confirm="Clear flag"
                  run={row.clear}
                />
              </div>
            </div>
          ))
        )}
      </section>
    </OpsPage>
  );
}
