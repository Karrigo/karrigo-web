import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { EmptyState, LinkTab, Pager } from "@/components/admin/ui";
import { api, type Schemas } from "@/lib/api/client";
import { whenLabel } from "@/lib/admin/format";
import { staffLabel } from "@/lib/admin/staff";
import { requireAdmin } from "@/lib/admin/session";

type Search = { entity?: string; page?: string };
const PAGE_SIZE = 50;

const ENTITIES = [
  { key: "", label: "Everything" },
  { key: "Kitchen", label: "Kitchens" },
  { key: "Rider", label: "Riders" },
  { key: "Order", label: "Orders" },
  { key: "User", label: "Customers" },
  { key: "SupportTicket", label: "Tickets" },
  { key: "Admin", label: "Team" },
];

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false });

function actor(e: Schemas["AuditLogEntryDto"]): string {
  if (e.actorAdmin) return e.actorAdmin.name;
  if (e.actorKitchenStaff) return staffLabel(e.actorKitchenStaff);
  if (e.actorUser) return e.actorUser.name ?? e.actorUser.phone ?? "Customer";
  return "System";
}

/** A short, readable line from the metadata — a note, a status, an amount. */
function detail(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const move = typeof m.from === "string" && typeof m.to === "string" ? `${m.from} → ${m.to}` : "";
  const parts = ["status", "note", "amountNaira", "adminRole", "isHidden"]
    .filter((k) => m[k] !== undefined && m[k] !== null && m[k] !== "")
    .map((k) => (k === "amountNaira" ? `₦${Number(m[k]).toLocaleString("en-NG")}` : k === "isHidden" ? (m[k] ? "hidden" : "shown") : String(m[k])));
  return [move, ...parts].filter(Boolean).join(" · ");
}

/** Every recorded action, with who and when — mostly the ops team, but also
 *  kitchens and riders (a rider resubmitting for review, say). Read only —
 *  the record is the point. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const s = await searchParams;
  const page = Math.max(1, Number(s.page) || 1);
  const log = await api<Schemas["AuditLogPageDto"]>("/admin/audit-log", {
    scope: "admin",
    query: { page, pageSize: PAGE_SIZE, entity: s.entity },
  });
  const href = (patch: Search) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...s, ...patch })) if (v) p.set(k, v);
    const q = p.toString();
    return `/audit${q ? `?${q}` : ""}`;
  };

  return (
    <OpsPage>
      <OpsPageHeader title="Audit log" meta={`${log.total} action${log.total === 1 ? "" : "s"} recorded · newest first`} />
      <section className="bg-ops-surface ops-scroll-x min-w-0 rounded-[15px]">
        <div className="border-text/6 flex flex-wrap gap-2 border-b px-lg py-3.5">
          {ENTITIES.map((e) => (
            <LinkTab key={e.key} href={href({ entity: e.key, page: "" })} label={e.label} selected={(s.entity ?? "") === e.key} />
          ))}
        </div>
        {log.items.length === 0 ? (
          <EmptyState title="Nothing recorded" text="Approvals, refunds, payouts and team changes are logged here as they happen." />
        ) : (
          <div className="min-w-[620px]">
            {log.items.map((e) => (
              <div key={e.id} className="border-text/6 grid grid-cols-[110px_minmax(120px,1fr)_minmax(160px,1.4fr)_minmax(120px,1.2fr)] items-baseline gap-3 border-b px-lg py-3 text-[13px]">
                <span className="text-text/55 text-[12px]">
                  {whenLabel(e.createdAt).startsWith("Today") || whenLabel(e.createdAt).startsWith("Yesterday")
                    ? whenLabel(e.createdAt)
                    : `${whenLabel(e.createdAt)} ${clock.format(new Date(e.createdAt))}`}
                </span>
                <span className="text-text truncate font-semibold">{actor(e)}</span>
                <span className="text-text/85 truncate">
                  {e.action.replace(/[._]/g, " ").toLowerCase()} · {e.entity.toLowerCase()}
                </span>
                <span className="text-text/55 truncate text-[12px]" title={JSON.stringify(e.metadata ?? {})}>
                  {detail(e.metadata) || e.entityId.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Pager page={page} pageSize={PAGE_SIZE} total={log.total} href={(p) => href({ page: String(p) })} />
      </section>
    </OpsPage>
  );
}
