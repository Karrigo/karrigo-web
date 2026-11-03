"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

type Side = "kitchen" | "store";

const sideOf = (pathname: string): Side | null =>
  pathname.startsWith("/my-store") ? "store" : pathname.startsWith("/my-kitchen") ? "kitchen" : null;

/**
 * A sliding Kitchen | Store switch for the consoles. It lives in the shared
 * layout rather than in either console, so it is the same element before and
 * after the switch and the thumb really slides; inside a console it would be
 * rebuilt on every change. It shows itself only on the console pages.
 */
export function AccountSwitch({ sides }: { sides: { side: Side; label: string; href: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = sideOf(pathname);
  // The side just tapped, until the new page arrives, so the thumb moves at
  // once. Tied to the page it was tapped on, so it clears itself on arrival.
  const [tapped, setTapped] = useState<{ side: Side; from: string } | null>(null);
  const [, startTransition] = useTransition();

  if (!current) return null;
  const shown = tapped && tapped.from === pathname ? tapped.side : current;

  return (
    <div className="mb-lg flex justify-center">
      <nav
        aria-label="Accounts"
        className="bg-bg rounded-pill p-xs text-site-label relative grid w-[300px] max-w-full grid-cols-2 font-bold"
      >
        <span
          aria-hidden
          className={cn(
            "bg-text rounded-pill absolute top-xs bottom-xs left-xs w-[calc(50%-4px)] transition-transform duration-(--duration-slow)",
            shown === "store" && "translate-x-full",
          )}
        />
        {sides.map((s) => (
          <button
            key={s.side}
            type="button"
            aria-current={s.side === current ? "page" : undefined}
            onClick={() => {
              if (s.side === shown) return;
              setTapped({ side: s.side, from: pathname });
              startTransition(() => router.push(s.href));
            }}
            className={cn(
              "rounded-pill px-lg py-xs relative text-center transition-colors duration-(--duration-slow)",
              shown === s.side ? "text-bg" : "text-text-secondary hover:text-text",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
