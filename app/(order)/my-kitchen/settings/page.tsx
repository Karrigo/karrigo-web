import type { Metadata } from "next";
import Link from "next/link";

import { HoursForm, ProfileForm } from "@/components/kitchen/Settings";
import { APPLICATION, getHours, requireOwner } from "@/lib/kitchen/data";

export const metadata: Metadata = { title: "Hours & details · Your kitchen · Karrigo" };

export default async function KitchenSettingsPage() {
  const kitchen = await requireOwner();
  const hours = await getHours();

  return (
    <div className="gap-lg flex flex-col">
      <HoursForm days={hours.days} everSaved={hours.saved} />
      <ProfileForm name={kitchen.name} cuisine={kitchen.cuisine} riderBaseFeeKobo={kitchen.riderBaseFeeKobo} />
      <p className="text-site-label text-text-secondary">
        Your photos, location, payout account and storefront image are on your{" "}
        <Link href={APPLICATION} className="text-accent-text font-bold">
          kitchen setup page
        </Link>
        .
      </p>
    </div>
  );
}
