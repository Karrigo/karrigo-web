"use client";

import { useNow } from "@/components/admin/useNow";
import { StatusChip } from "@/components/admin/ui";
import { riderOperationsView, type LiveOrder } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";

/** Subscribe only the rider cell/summary to the panel's existing shared clock. */
export function RiderOperations({ order, summary = false }: { order: LiveOrder; summary?: boolean }) {
  const now = useNow();
  const view = riderOperationsView(order, now ? new Date(now) : undefined);
  const waiting = order.riderId === null && order.riderWait.currentWaitStartedAt !== null;

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className={cn("font-semibold", waiting && "text-warning")}>
        {view.name}
      </span>
      {view.timing && <span className="text-text/62 text-xs">{view.timing}</span>}
      {view.reassignmentLabel && <span><StatusChip tone="warning">{view.reassignmentLabel}</StatusChip></span>}
      {summary && (
        <span className="text-text/62 mt-2 flex flex-col gap-1 text-xs">
          <span>Initial rider wait: {view.initialWaitLabel}</span>
          <span>Total unassigned wait: {view.totalWaitLabel}</span>
          <span>Current unassigned wait: {view.currentWaitLabel}</span>
          <span>{order.assignmentCount} recorded assignment{order.assignmentCount === 1 ? "" : "s"} · {order.reassignmentCount} reassignment{order.reassignmentCount === 1 ? "" : "s"}</span>
        </span>
      )}
    </span>
  );
}
