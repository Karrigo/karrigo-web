import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { KitchenLogin } from "@/components/partners/KitchenApply";
import { getPartner } from "@/lib/partners/data";

export const metadata: Metadata = { title: "Kitchen log in · Karrigo" };

export default async function KitchenLoginPage() {
  // The kitchen has its own session: a store login does not open it. With a
  // kitchen it opens the console; an owner whose business has none goes to
  // the kitchen page to register one.
  const partner = await getPartner("kitchen");
  if (partner) redirect(partner.kitchenId ? "/my-kitchen" : "/partners/kitchen");
  return <KitchenLogin />;
}
