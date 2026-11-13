import Link from "next/link";

import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { CreditForm } from "@/components/admin/people/CreditForm";
import { EmptyState, Eyebrow, LinkTab, Pager, SearchBox, StatusChip, type Tone } from "@/components/admin/ui";
import { api, type Schemas } from "@/lib/api/client";
import { whenLabel } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/session";
import { cn } from "@/lib/cn";
import { formatKobo, nairaToKobo } from "@/lib/money";
import { setUserStatus } from "../../people-actions";

type Search = { q?: string; role?: string; status?: string; page?: string; id?: string };

const ROLES = [
  { key: "", label: "Everyone" },
  { key: "CUSTOMER", label: "Customers" },
  { key: "RIDER", label: "Riders" },
];

const STATUS_TONE: Record<string, Tone> = { ACTIVE: "success", SUSPENDED: "danger", DELETED: "muted" };
const PAGE_SIZE = 25;

function href(s: Search, patch: Partial<Search>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...s, ...patch })) if (v) params.set(k, v);
  const query = params.toString();
  return `/customers${query ? `?${query}` : ""}`;
}

/**
 * Every customer and rider account. Search by name, phone or email — usually
 * the phone number someone reads out on a call — and open one to see their
 * orders, addresses and tickets, credit them, or suspend them.
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const s = await searchParams;
  const page = Math.max(1, Number(s.page) || 1);

  const [list, detail] = await Promise.all([
    api<Schemas["AdminUserPageDto"]>("/admin/users", {
      scope: "admin",
      query: { q: s.q, role: s.role, status: s.status, page, pageSize: PAGE_SIZE },
    }),
    s.id ? api<Schemas["AdminUserDetailDto"]>(`/admin/users/${s.id}`, { scope: "admin" }).catch(() => null) : null,
  ]);

  return (
    <OpsPage>
      <OpsPageHeader title="Customers" meta={`${list.total} account${list.total === 1 ? "" : "s"} · newest first`} />

      <div className="flex flex-wrap items-start gap-3.5">
        <section className="bg-ops-surface min-w-0 flex-[3_1_460px] rounded-[15px]">
          <div className="border-text/6 flex flex-wrap items-center gap-2 border-b px-lg py-3.5">
            {ROLES.map((r) => (
              <LinkTab key={r.key} href={href(s, { role: r.key, page: "", id: "" })} label={r.label} selected={(s.role ?? "") === r.key} />
            ))}
            <SearchBox defaultValue={s.q} placeholder="Name, phone or email" hidden={{ role: s.role, status: s.status }} />
          </div>

          {list.items.length === 0 ? (
            <EmptyState
              title={s.q ? `Nobody matches “${s.q}”` : "No accounts yet"}
              text={s.q ? "Try the last few digits of their phone number." : "People appear here when they sign up."}
            />
          ) : (
            list.items.map((u) => (
              <Link
                key={u.id}
                href={href(s, { id: u.id })}
                className={cn(
                  "border-text/6 hover:bg-text/4 flex items-center justify-between gap-3 border-b px-lg py-3.5",
                  s.id === u.id && "bg-accent/8",
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-text truncate text-[14px] font-semibold">{u.name ?? u.phone ?? "Customer"}</span>
                  <span className="text-text/55 truncate text-[12px] font-light">
                    {u.phone} · {u.role === "RIDER" ? "rider" : "customer"} · {u.orderCount} order{u.orderCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1.5">
                  {u.status !== "ACTIVE" && <StatusChip tone={STATUS_TONE[u.status]}>{u.status.toLowerCase()}</StatusChip>}
                  <span className="text-text/55 text-[11.5px] font-light">Joined {whenLabel(u.createdAt)}</span>
                </span>
              </Link>
            ))
          )}
          <Pager page={page} pageSize={PAGE_SIZE} total={list.total} href={(p) => href(s, { page: String(p) })} />
        </section>

        <aside className="sticky top-5 min-w-0 max-w-full flex-[2_1_380px]">
          {detail ? (
            <UserDetail user={detail} />
          ) : (
            <div data-theme="light" className="bg-ops-surface text-text/62 rounded-[15px] px-lg py-[60px] text-center text-[14px]">
              {s.id ? "That account couldn't be loaded." : "Pick someone to see their account."}
            </div>
          )}
        </aside>
      </div>
    </OpsPage>
  );
}

function UserDetail({ user }: { user: Schemas["AdminUserDetailDto"] }) {
  const name = user.name ?? user.phone ?? "Customer";
  return (
    <div data-theme="light" className="bg-ops-surface text-text overflow-hidden rounded-[15px]">
      <header className="border-text/8 flex items-start justify-between gap-3 border-b px-[22px] py-lg">
        <div className="min-w-0">
          <h2 className="truncate text-[20px]/none font-extrabold tracking-[-0.03em]">{name}</h2>
          <p className="text-text/62 mt-2 text-[12.5px]">
            {user.phone}
            {user.email ? ` · ${user.email}` : ""} · joined {whenLabel(user.createdAt)}
          </p>
        </div>
        <StatusChip tone={STATUS_TONE[user.status]}>{user.status.toLowerCase()}</StatusChip>
      </header>

      <dl className="border-text/8 grid grid-cols-2 gap-x-3 gap-y-3.5 border-b px-[22px] py-lg">
        {[
          ["Orders", `${user.stats.orderCount} · ${user.stats.deliveredOrderCount} delivered`],
          ["Spent", formatKobo(nairaToKobo(user.stats.lifetimeSpendNaira))],
          ["Store credit", formatKobo(nairaToKobo(user.creditBalanceNaira))],
          ["Cancelled", String(user.stats.cancelledOrderCount)],
          ...(user.riderProfile
            ? [["Rider", `${user.riderProfile.verificationStatus.toLowerCase()} · ${user.riderProfile.status.toLowerCase().replace("_", " ")}`]]
            : []),
        ].map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col gap-1">
            <Eyebrow className="text-[10.5px]">{k}</Eyebrow>
            <dd className="truncate text-[13px] font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {user.addresses.length > 0 && (
        <div className="border-text/8 border-b px-[22px] py-3.5">
          <Eyebrow className="text-[10.5px]">Addresses</Eyebrow>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
            {user.addresses.map((a) => (
              <li key={a.id}>
                {a.line1}, {a.area}
                {a.instructions ? <span className="text-text/55"> · {a.instructions}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {user.recentOrders.length > 0 && (
        <div className="border-text/8 border-b px-[22px] py-3.5">
          <Eyebrow className="text-[10.5px]">Recent orders</Eyebrow>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
            {user.recentOrders.map((o) => (
              <li key={o.id} className="flex justify-between gap-3">
                <Link href={`/orders?order=${o.code}`} className="text-accent-text font-semibold">
                  {o.code}
                </Link>
                <span className="text-text/62">
                  {o.status.toLowerCase().replace("_", " ")} · {whenLabel(o.placedAt)} · {formatKobo(nairaToKobo(o.totalNaira))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {user.recentTickets.length > 0 && (
        <div className="border-text/8 border-b px-[22px] py-3.5">
          <Eyebrow className="text-[10.5px]">Tickets</Eyebrow>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
            {user.recentTickets.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span className="truncate">{t.subject}</span>
                <span className="text-text/62">{t.status.toLowerCase().replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 px-[22px] py-lg">
        {user.status === "ACTIVE" && user.role === "CUSTOMER" && <CreditForm customerId={user.id} name={name} />}
        <div className="flex flex-wrap gap-2">
          {user.status === "ACTIVE" ? (
            <ConfirmAction
              label="Suspend account"
              title={`Suspend ${name}?`}
              text="They're signed out everywhere and can't order or ride until reactivated."
              confirm="Suspend"
              tone="bad"
              note={{ placeholder: "Reason (required) · saved to the audit log", required: true }}
              run={setUserStatus.bind(null, user.id, "SUSPENDED")}
            />
          ) : user.status === "SUSPENDED" ? (
            <ConfirmAction
              label="Reactivate account"
              title={`Reactivate ${name}?`}
              text="They can sign in and order again straight away."
              confirm="Reactivate"
              tone="go"
              run={setUserStatus.bind(null, user.id, "ACTIVE")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
