import Image from "next/image";

import { cn } from "@/lib/cn";

/** The lockup in the sidebar and on the sign-in screen. "Operations" under
 *  the wordmark is how ops tells at a glance that this is not the customer
 *  site — the two look alike and one of them can refund money. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/brand/karrigo-admin-icon.png"
        alt=""
        width={512}
        height={512}
        style={{ width: size, height: size }}
        className="flex-none"
      />
      <span className="flex flex-col gap-[3px]">
        <span
          className={cn(
            "text-text leading-none font-extrabold tracking-[-0.055em]",
            size > 34 ? "text-[24px]" : "text-[19px]",
          )}
        >
          karrigo
        </span>
        <span className="text-text/55 text-[10.5px] leading-none font-semibold tracking-[0.12em] uppercase">
          Operations
        </span>
      </span>
    </span>
  );
}
