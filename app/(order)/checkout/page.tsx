import type { Metadata } from "next";
import { Checkout } from "@/components/order/Checkout";
import { getPartner } from "@/lib/partners/data";
import { listAreaNames } from "@/lib/shop/areas";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = { title: "Checkout · Karrigo", robots: { index: false } };

export default async function CheckoutPage() {
  const [customer, areas, partner] = await Promise.all([
    getCustomer(),
    listAreaNames(),
    getPartner().catch(() => null),
  ]);
  return <Checkout customer={customer} areas={areas} businessSignedIn={partner !== null} />;
}
