"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { pollWaitingOrders, type WaitingOrder } from "@/app/(order)/business-orders";
import { formatKobo } from "@/lib/money";
import { freshOrders, orderKey } from "@/lib/order/new-orders";

/** How often to look for new orders. The same cadence as the console's bell:
 *  short enough to matter, long enough not to eat a data bundle. */
const POLL_MS = 15_000;
/** How long a toast stays before it leaves on its own. */
const SHOW_MS = 12_000;

const ORDERS = { kitchen: "/my-kitchen/orders", store: "/my-store/orders" } as const;

type Toast = WaitingOrder & { key: string };

/**
 * Tells a business a new order has arrived, from wherever they are on the
 * site, top right. It watches every side they are signed in to, so a kitchen
 * owner browsing the kitchen console hears about a store order and the other
 * way round. It stays quiet on a side's own orders page, where the board
 * already shows the order.
 *
 * Browsers get no push for a web page, so this polls while the tab is
 * visible. The first look only learns what was already waiting.
 */
export function NewOrderToasts({ kitchen, store }: { kitchen: boolean; store: boolean }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  });

  const dismiss = useCallback((key: string) => setToasts((all) => all.filter((t) => t.key !== key)), []);

  const check = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    let waiting: WaitingOrder[];
    try {
      waiting = await pollWaitingOrders();
    } catch {
      return;
    }
    const before = seen.current;
    seen.current = new Set(waiting.map(orderKey));
    const fresh = freshOrders(before, waiting, here.current);
    if (fresh.length === 0) return;
    setToasts((all) => [...fresh.map((o) => ({ ...o, key: orderKey(o) })), ...all].slice(0, 4));
    for (const o of fresh) setTimeout(() => dismiss(orderKey(o)), SHOW_MS);
  }, [dismiss]);

  const watching = kitchen || store;
  useEffect(() => {
    if (!watching) return;
    void check();
    const id = setInterval(() => void check(), POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      seen.current = null;
    };
  }, [watching, check]);

  if (!watching || toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="pointer-events-none fixed top-lg right-screen-x z-50 flex w-[340px] max-w-[calc(100vw-2*var(--spacing-screen-x,16px))] flex-col gap-sm">
      {toasts.map((t) => (
        <div
          key={t.key}
          role="status"
          data-theme="dark"
          className="bg-bg text-cream rounded-panel-sm toast-in pointer-events-auto flex items-start gap-md p-lg shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)]"
        >
          <span aria-hidden className="bg-accent mt-xs size-[10px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="text-site-label font-bold">New {t.side} order · {t.code}</p>
            <p className="text-site-label text-cream/70 mt-xs">
              {t.itemCount} item{t.itemCount === 1 ? "" : "s"} · {formatKobo(t.subtotalKobo)}
              {t.area && ` · going to ${t.area}`}
            </p>
            <Link
              href={ORDERS[t.side]}
              onClick={() => dismiss(t.key)}
              className="text-accent-text text-site-label mt-sm inline-block font-bold"
            >
              View {t.side === "store" ? "store" : "kitchen"} orders →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.key)}
            aria-label="Dismiss"
            className="text-cream/60 hover:text-cream text-site-label shrink-0 font-bold"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
