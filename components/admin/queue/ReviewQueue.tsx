"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import {
  QUEUE_TABS,
  payoutKobo,
  queueStatusLabel,
  type QueueItem,
  type QueueKind,
  type QueueStatus,
} from "@/lib/admin/queue";
import { say } from "@/lib/admin/store";
import {
  declineAppeal,
  payOut,
  setKitchenStatus,
  setRiderVerification,
  setRequiresCac,
  setStoreStatus,
} from "@/app/(admin)/admin/queue-actions";
import type { AdminRole } from "@/lib/admin/types";
import { CountTab, EmptyState, StatusChip, type Tone } from "@/components/admin/ui";

import { QueueDetail } from "./QueueDetail";

const TONE: Record<QueueStatus, Tone> = {
  PENDING: "warning",
  ACTIVE: "success",
  APPROVED: "success",
  SUSPENDED: "danger",
  REJECTED: "danger",
};

/**
 * The approval queue, for kitchens and for riders. Pending first and oldest
 * first: an application sitting for three days is a kitchen that has probably
 * given up on us.
 */
export function ReviewQueue({
  kind,
  role,
  items,
}: {
  kind: QueueKind;
  role: AdminRole;
  items: QueueItem[];
}) {
  const [busy, startTransition] = useTransition();

  const tabs = QUEUE_TABS[kind];
  const [tab, setTab] = useState<QueueStatus>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = items.filter((item) => item.status === tab);
  const selected =
    list.find((item) => item.id === selectedId) ?? list[0] ?? null;

  /** Runs a server action, then says what happened in the backend's words —
   *  success or the reason it refused. The page re-renders from the server. */
  function run(action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      say(result.ok ? result.message : result.error);
      if (result.ok) setSelectedId(null);
    });
  }

  function declineAppealFor(item: QueueItem, response: string) {
    if (kind === "riders") return;
    run(() => declineAppeal(kind, item.id, response));
  }

  function setCac(item: QueueItem, requiresCac: boolean) {
    if (kind === "riders") return;
    run(() => setRequiresCac(kind, item.id, requiresCac));
  }

  function decide(item: QueueItem, status: QueueStatus, note: string) {
    run(() =>
      kind === "kitchens"
        ? setKitchenStatus(item.id, status === "ACTIVE" ? "ACTIVE" : "SUSPENDED", note)
        : kind === "stores"
          ? setStoreStatus(item.id, status === "ACTIVE" ? "ACTIVE" : "SUSPENDED", note)
          : setRiderVerification(item.id, status === "APPROVED" ? "APPROVED" : "REJECTED", note),
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <section className="bg-ops-surface min-w-0 flex-[3_1_460px] rounded-[15px]">
        <div className="border-text/6 flex flex-wrap gap-2 border-b px-lg py-3.5">
          {tabs.map(({ status, label }) => (
            <CountTab
              key={status}
              label={label}
              count={items.filter((item) => item.status === status).length}
              selected={tab === status}
              onClick={() => {
                setTab(status);
                setSelectedId(null);
              }}
            />
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState
            title={`No ${tabs
              .find((t) => t.status === tab)!
              .label.toLowerCase()} ${kind}`}
            text="Applications land here as they come in."
          />
        ) : (
          list.map((item) => {
            const missing = item.checks.filter((check) => !check.ok).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "border-text/6 hover:bg-text/4 flex w-full items-center justify-between gap-3 border-b px-lg py-3.5 text-left",
                  selected?.id === item.id && "bg-accent/8",
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-text truncate text-[14px] font-semibold">
                    {item.title}
                  </span>
                  <span className="text-text/55 truncate text-[12px] font-light">
                    {item.sub}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1.5">
                  <StatusChip tone={TONE[item.status]}>
                    {item.status === "PENDING"
                      ? missing === 0
                        ? "Ready to review"
                        : `${missing} missing`
                      : queueStatusLabel(item)}
                  </StatusChip>
                  <span className="text-text/55 text-[11.5px] font-light">
                    {item.status === "PENDING"
                      ? item.when
                      : item.unpaidKobo
                        ? `${formatKobo(payoutKobo(item))} due`
                        : item.when}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </section>

      <aside className="sticky top-5 min-w-0 max-w-full flex-[2_1_380px]">
        {selected ? (
          <QueueDetail
            kind={kind}
            item={selected}
            role={role}
            onDecide={decide}
            onDeclineAppeal={declineAppealFor}
            onSetRequiresCac={setCac}
            busy={busy}
            onPayout={
              kind === "stores"
                ? undefined
                : () => run(() => payOut(kind, selected.id))
            }
          />
        ) : (
          <div
            data-theme="light"
            className="bg-ops-surface text-text/62 rounded-[15px] px-lg py-[60px] text-center text-[14px]"
          >
            Pick one to review it.
          </div>
        )}
      </aside>
    </div>
  );
}
