import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** The customer app's mark: a lime tile with an ink bag. The ops panel has the
 *  inverse (ink tile, lime bag) so the two are never mistaken for each other.
 *  The tile never changes between themes; only the wordmark beside it does.
 *  Light grounds get the near-black wordmark, dark grounds the cream one. */
const tile = { src: "/brand/karrigo-icon.png", size: 512 } as const;
const wordmarks = {
  light: { src: "/brand/karrigo-wordmark.png", width: 572, height: 288 },
  dark: { src: "/brand/karrigo-wordmark-dark.png", width: 228, height: 116 },
} as const;

type WordmarkLockup = (typeof wordmarks)[keyof typeof wordmarks];

function Wordmark({ w, extra, priority = true }: { w: WordmarkLockup; extra?: string; priority?: boolean }) {
  return (
    <Image
      src={w.src}
      alt=""
      width={w.width}
      height={w.height}
      priority={priority}
      className={cn("h-logo w-auto", extra)}
    />
  );
}

/** The tile and wordmark without the link, for places that are not a home button. */
export function LogoLockup({
  mode = "light",
  className,
}: {
  mode?: "light" | "dark";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-sm", className)}>
      <Image
        src={tile.src}
        alt=""
        width={tile.size}
        height={tile.size}
        priority
        className="h-logo w-auto"
      />
      <Wordmark w={wordmarks[mode]} extra={mode === "light" ? "logo-on-light" : undefined} />
      {/* A light-ground logo must still read when the whole page goes dark, so
          the light wordmark carries a cream twin that globals.css swaps in. It
          is never displayed (so never fetched) in light mode. */}
      {mode === "light" && <Wordmark w={wordmarks.dark} extra="logo-on-dark" priority={false} />}
    </span>
  );
}

export function Logo({
  mode = "light",
  className,
}: {
  mode?: "light" | "dark";
  className?: string;
}) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)} aria-label="Karrigo home">
      <LogoLockup mode={mode} />
    </Link>
  );
}
