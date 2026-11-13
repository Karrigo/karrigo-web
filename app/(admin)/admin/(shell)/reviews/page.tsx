import Link from "next/link";

import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { EmptyState, LinkTab, Pager, StatusChip } from "@/components/admin/ui";
import { api, type Schemas } from "@/lib/api/client";
import { whenLabel } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/session";
import { setReviewHidden } from "../../people-actions";

type Search = { view?: string; rating?: string; page?: string };
const PAGE_SIZE = 25;

const VIEWS = [
  { key: "", label: "All" },
  { key: "low", label: "1–2 stars" },
  { key: "hidden", label: "Hidden" },
];

function href(s: Search, patch: Partial<Search>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...s, ...patch })) if (v) p.set(k, v);
  const q = p.toString();
  return `/reviews${q ? `?${q}` : ""}`;
}

/**
 * Ratings customers left for kitchens and riders. Hiding one takes it out of
 * the public average — the backend recalculates in the same step — so it is
 * for abuse and wrong-order mix-ups, not for reviews someone dislikes.
 */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const s = await searchParams;
  const page = Math.max(1, Number(s.page) || 1);
  const view = s.view ?? "";

  // "1–2 stars" is two queries; the backend filters one exact rating at a time.
  const fetchPage = (rating?: number) =>
    api<Schemas["AdminReviewPageDto"]>("/admin/reviews", {
      scope: "admin",
      query: {
        page,
        pageSize: PAGE_SIZE,
        ...(view === "hidden" ? { isHidden: true } : {}),
        ...(rating ? { rating } : {}),
      },
    });

  let items: Schemas["AdminReviewListItemDto"][];
  let total: number;
  if (view === "low") {
    const [one, two] = await Promise.all([fetchPage(1), fetchPage(2)]);
    items = [...one.items, ...two.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    total = one.total + two.total;
  } else {
    const result = await fetchPage();
    items = result.items;
    total = result.total;
  }

  return (
    <OpsPage>
      <OpsPageHeader title="Reviews" meta={`${total} review${total === 1 ? "" : "s"} · newest first`} />

      <section className="bg-ops-surface min-w-0 rounded-[15px]">
        <div className="border-text/6 flex flex-wrap items-center gap-2 border-b px-lg py-3.5">
          {VIEWS.map((v) => (
            <LinkTab key={v.key} href={href(s, { view: v.key, page: "" })} label={v.label} selected={view === v.key} />
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={view === "hidden" ? "Nothing hidden" : "No reviews yet"}
            text="Customers rate the kitchen and the rider after each delivery."
          />
        ) : (
          items.map((r) => {
            const target = r.kitchen ? r.kitchen.name : r.rider ? `${r.rider.user.name ?? r.rider.user.phone ?? "Customer"} (rider)` : "—";
            const avg = r.kitchen ?? r.rider;
            return (
              <div key={r.id} className="border-text/6 flex flex-wrap items-start justify-between gap-3 border-b px-lg py-3.5">
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                  <span className="text-text text-[14px] font-semibold">
                    <span className={r.rating <= 2 ? "text-danger" : "text-text"}>
                      {"★".repeat(r.rating)}
                      <span className="text-text/20">{"★".repeat(5 - r.rating)}</span>
                    </span>{" "}
                    {target}
                    {r.isHidden && (
                      <span className="ml-2 align-middle">
                        <StatusChip tone="muted">Hidden</StatusChip>
                      </span>
                    )}
                  </span>
                  {r.comment && <p className="text-text/85 text-[13px]/[1.5]">“{r.comment}”</p>}
                  <span className="text-text/55 text-[12px] font-light">
                    {r.author.name ?? r.author.phone ?? "Customer"} ·{" "}
                    <Link href={`/orders?order=${r.order.code}`} className="text-accent-text font-semibold">
                      {r.order.code}
                    </Link>{" "}
                    · {whenLabel(r.createdAt)}
                    {avg ? ` · now ${avg.ratingAvg.toFixed(1)} from ${avg.ratingsCount}` : ""}
                  </span>
                </div>
                <div className="flex max-w-full flex-[0_1_320px] justify-end">
                  {r.isHidden ? (
                    <ConfirmAction
                      size="sm"
                      tone="line"
                      label="Show again"
                      title="Show this review again?"
                      text="It counts towards the rating again."
                      confirm="Show review"
                      run={setReviewHidden.bind(null, r.id, false)}
                    />
                  ) : (
                    <ConfirmAction
                      size="sm"
                      tone="bad"
                      label="Hide"
                      title="Hide this review?"
                      text={`It stops counting towards ${target}'s rating.`}
                      confirm="Hide review"
                      note={{ placeholder: "Why (saved to the audit log)" }}
                      run={setReviewHidden.bind(null, r.id, true)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
        {view !== "low" && <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href(s, { page: String(p) })} />}
      </section>
    </OpsPage>
  );
}
