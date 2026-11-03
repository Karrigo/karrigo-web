import type { Metadata } from "next";

import { Empty, panel } from "@/components/kitchen/parts";
import { cn } from "@/lib/cn";
import { getStoreEarnings, listStorePayouts, requireStoreOwner } from "@/lib/store/data";
import { formatKobo } from "@/lib/money";
import type { Payout } from "@/lib/kitchen/types";

export const metadata: Metadata = { title: "Money · Your store · Karrigo" };

const date = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS: Record<Payout["status"], { label: string; tone: string }> = {
  SETTLED: { label: "Paid", tone: "text-accent-text" },
  PENDING: { label: "On its way", tone: "text-warning" },
  FAILED: { label: "Didn't go through", tone: "text-danger-text" },
};

export default async function StoreMoneyPage() {
  const store = await requireStoreOwner();
  const [earnings, payouts] = await Promise.all([getStoreEarnings(), listStorePayouts()]);

  // The backend sends the share as a fraction; tolerate a percentage too.
  const share = earnings.commissionRate <= 1 ? earnings.commissionRate * 100 : earnings.commissionRate;
  const days = earnings.nextPayoutDaysAway;

  return (
    <div className="gap-lg flex flex-col">
      <section className={panel}>
        <p className="text-site-label text-text-secondary">Your next payout</p>
        <p className="text-panel-small md:text-panel mt-xs">{formatKobo(earnings.nextPayoutKobo)}</p>
        <p className="text-site-body text-text-secondary mt-sm">
          {earnings.nextPayoutOrders === 0
            ? `Nothing owed yet. Finished orders from ${store.name} add up here.`
            : `From ${earnings.nextPayoutOrders} finished order${earnings.nextPayoutOrders === 1 ? "" : "s"}, due ${
                days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`
              }.`}
        </p>
        <dl className="border-surface-raised text-site-body mt-lg border-t pt-md">
          <div className="flex justify-between py-xs">
            <dt className="text-text-secondary">Groceries sold</dt>
            <dd className="font-bold">{formatKobo(earnings.salesKobo)}</dd>
          </div>
          <div className="flex justify-between py-xs">
            <dt className="text-text-secondary">Karrigo&rsquo;s {Math.round(share)}%</dt>
            <dd className="font-bold">−{formatKobo(earnings.commissionKobo)}</dd>
          </div>
        </dl>
      </section>

      <h2 className="text-site-title">Past payouts</h2>
      {payouts.length === 0 ? (
        <Empty
          title="No payouts yet"
          text={`When Karrigo pays ${store.name}, each transfer is listed here with the orders it covered.`}
        />
      ) : (
        <ul className="bg-bg rounded-panel-sm px-xl">
          {payouts.map((p) => (
            <li key={p.id} className="border-surface-raised gap-md flex items-center justify-between border-b py-md last:border-b-0">
              <span className="min-w-0">
                <span className="text-site-question block">{date.format(new Date(p.at))}</span>
                <span className="text-site-label text-text-secondary mt-xs block">
                  <span className={cn("font-semibold", STATUS[p.status].tone)}>{STATUS[p.status].label}</span> · {p.orders} order
                  {p.orders === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-site-body shrink-0 font-bold">{formatKobo(p.amountKobo)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
