import type { Metadata } from "next";
import { Checkout } from "@/components/order/Checkout";
import { hasPartnerSession } from "@/lib/partners/data";
import { listAreaNames } from "@/lib/shop/areas";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = { title: "Checkout · Karrigo", robots: { index: false } };

export default async function CheckoutPage() {
  const [customer, areas, partner] = await Promise.all([
    getCustomer(),
    listAreaNames(),
    hasPartnerSession(),
  ]);
  return <Checkout customer={customer} areas={areas} businessSignedIn={partner} />;
}
