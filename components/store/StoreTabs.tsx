"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const TABS = [
  { href: "/my-store", label: "Today", ownerOnly: false },
  { href: "/my-store/orders", label: "Orders", ownerOnly: false },
  { href: "/my-store/products", label: "Products", ownerOnly: true },
  { href: "/my-store/settings", label: "Details", ownerOnly: true },
  { href: "/my-store/money", label: "Money", ownerOnly: true },
];

/** The store console's sections. A row that scrolls sideways on a phone, so
 *  every section is one thumb-reach away and none hides behind a menu. */
export function StoreTabs({ owner, waiting }: { owner: boolean; waiting: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Store" className="-mx-screen-x px-screen-x gap-xs flex overflow-x-auto pb-xs">
      {TABS.filter((t) => owner || !t.ownerOnly).map((t) => {
        const current = t.href === "/my-store" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-pill text-nav-link gap-sm flex shrink-0 items-center px-lg py-sm transition-colors duration-(--duration-fast)",
              current ? "bg-text text-bg" : "bg-bg text-text hover:bg-surface-raised",
            )}
          >
            {t.label}
            {t.href === "/my-store/orders" && waiting > 0 && (
              <span className="bg-accent text-on-accent rounded-pill text-label grid h-[20px] min-w-[20px] place-items-center px-xs font-bold">
                {waiting}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
