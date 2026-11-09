"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { categoryHref } from "@/lib/category-filter";
import { cn } from "@/lib/cn";

/** Single-select category row. Each chip is a link to ?category=<id> (All drops it), so the list is server-rendered and the filtered view can be shared. */
export function CategoryChips({
  categories,
  selectedId,
  label,
}: {
  categories: { id: string; name: string }[];
  selectedId: string | undefined;
  label: string;
}) {
  const pathname = usePathname();
  const chips = [{ id: null, name: "All" }, ...categories];
  return (
    <div className="gap-sm mt-xl flex flex-wrap" role="group" aria-label={label}>
      {chips.map((c) => {
        const active = (c.id ?? undefined) === selectedId;
        return (
          <Link
            key={c.id ?? "all"}
            href={categoryHref(pathname, c.id)}
            scroll={false}
            aria-current={active ? "true" : undefined}
            data-theme={active ? "dark" : undefined}
            className={cn(
              "rounded-pill text-nav-link px-lg py-sm font-bold transition-colors duration-(--duration-fast)",
              active ? "bg-bg text-accent-text" : "bg-bg text-text hover:bg-surface-raised",
            )}
          >
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}
