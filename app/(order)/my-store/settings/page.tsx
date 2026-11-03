import type { Metadata } from "next";
import Link from "next/link";

import { StoreDetails } from "@/components/store/StoreDetails";
import { STORE_APPLICATION, requireStoreOwner } from "@/lib/store/data";

export const metadata: Metadata = { title: "Details · Your store · Karrigo" };

export default async function StoreSettingsPage() {
  const store = await requireStoreOwner();

  return (
    <div className="gap-lg flex flex-col">
      <StoreDetails name={store.name} riderBaseFeeKobo={store.riderBaseFeeKobo} />
      <p className="text-site-label text-text-secondary">
        Your photos, location, payout account and storefront image are on your{" "}
        <Link href={STORE_APPLICATION} className="text-accent-text font-bold">
          store setup page
        </Link>
        .
      </p>
    </div>
  );
}
