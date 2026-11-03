import type { Metadata } from "next";
import Link from "next/link";

import { Eyebrow } from "@/components/site/Eyebrow";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = {
  title: "Partner with Karrigo",
  description: "Cook, sell or ride with Karrigo in Makurdi.",
};

const ways = [
  {
    href: "/partners/kitchen",
    title: "Cook with Karrigo",
    text: "List your kitchen, set your own prices and get orders from your area. Karrigo keeps 15% of what you sell.",
    action: "List my kitchen",
  },
  {
    href: "/partners/store",
    title: "Sell your groceries on Karrigo",
    text: "New customers nearby, without opening another branch. Karrigo keeps 10% of what you sell.",
    action: "Register my store",
  },
  {
    href: "/partners/rider",
    title: "Ride with Karrigo",
    text: "Deliver when it suits you. You're paid per trip, paid for waiting at a slow kitchen, and every tip is yours.",
    action: "Apply to ride",
  },
];

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <Eyebrow className="rise">Partner with us</Eyebrow>
      <h1 className="text-section-small md:text-section rise rise-1 mt-md mb-xxl text-balance">
        Earn with Karrigo
      </h1>
      <div className="gap-xl grid md:grid-cols-2">
        {ways.map((way) => (
          <Link key={way.href} href={way.href} className="group block transition-transform duration-(--duration-normal) hover:-translate-y-1.5">
            <Screen mode="dark" className="rounded-panel-md p-xxl md:p-pad-card flex h-full flex-col">
              <h2 className="text-panel-small text-cream">{way.title}</h2>
              <p className="text-site-body text-cream/66 mt-md mb-xxl flex-1">{way.text}</p>
              <span className="bg-accent text-on-accent rounded-pill text-site-button self-start px-xl py-md font-bold">
                {way.action} →
              </span>
            </Screen>
          </Link>
        ))}
      </div>
      <p className="text-site-body text-text-secondary mt-xxl">
        Already have a business account? Log in to your{" "}
        <Link href="/partners/kitchen/login" className="text-accent-text font-bold">
          kitchen
        </Link>{" "}
        or{" "}
        <Link href="/partners/store/login" className="text-accent-text font-bold">
          store
        </Link>
        .
      </p>
    </div>
  );
}
