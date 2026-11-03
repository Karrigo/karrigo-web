"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

type Option = {
  label: string;
  /** Where choosing it goes. */
  href: string;
  /** The pages it owns: it is current while the address starts with this. */
  prefix: string;
};

/**
 * A sliding two-way switch between two sections of the site. It belongs in a
 * layout that both sections share, so it is the same element before and after
 * the change and the thumb really slides (inside either section it would be
 * rebuilt on every change). It shows itself only on its sections' pages.
 */
export function PathSwitch({ options, label }: { options: [Option, Option]; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentIndex = options.findIndex((o) => pathname.startsWith(o.prefix));
  // The option just tapped, until the new page arrives, so the thumb moves at
  // once. Tied to the page it was tapped on, so it clears itself on arrival.
  const [tapped, setTapped] = useState<{ index: number; from: string } | null>(null);
  const [, startTransition] = useTransition();

  if (currentIndex === -1) return null;
  const shown = tapped && tapped.from === pathname ? tapped.index : currentIndex;

  return (
    <div className="mb-lg flex justify-center">
      <nav
        aria-label={label}
        className="bg-bg rounded-pill p-xs text-site-label relative grid w-[300px] max-w-full grid-cols-2 font-bold"
      >
        <span
          aria-hidden
          className={cn(
            "bg-text rounded-pill absolute top-xs bottom-xs left-xs w-[calc(50%-4px)] transition-transform duration-(--duration-slow)",
            shown === 1 && "translate-x-full",
          )}
        />
        {options.map((o, index) => (
          <button
            key={o.prefix}
            type="button"
            aria-current={index === currentIndex ? "page" : undefined}
            onClick={() => {
              if (index === shown) return;
              setTapped({ index, from: pathname });
              startTransition(() => router.push(o.href));
            }}
            className={cn(
              "rounded-pill px-lg py-xs relative text-center transition-colors duration-(--duration-slow)",
              shown === index ? "text-bg" : "text-text-secondary hover:text-text",
            )}
          >
            {o.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
