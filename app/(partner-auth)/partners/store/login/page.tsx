import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StoreLogin } from "@/components/partners/StoreApply";
import { getPartner } from "@/lib/partners/data";

export const metadata: Metadata = { title: "Store log in · Karrigo" };

export default async function StoreLoginPage() {
  // The store has its own session: a kitchen login does not open it. With a
  // store it opens the console (which sends one still applying on to its
  // application); an owner whose business has none goes to the store page to
  // register one.
  const partner = await getPartner("store");
  if (partner) redirect(partner.storeId ? "/my-store" : "/partners/store");
  return <StoreLogin />;
}
