import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/components/site/Eyebrow";
import { RiderApply } from "@/components/partners/RiderApply";
import { getRiderApplication, listBanks } from "@/lib/partners/data";
import { getApplicant } from "@/lib/shop/session";

export const metadata: Metadata = {
  title: "Ride with Karrigo",
  description: "Deliver with Karrigo in Makurdi.",
};

/** A rider is a Karrigo account with a rider profile attached, so this starts
 *  by making sure there is an account — verified by the SMS code — to attach
 *  it to. */
export default async function RiderPartnerPage() {
  const customer = await getApplicant();
  if (!customer) redirect("/signup?next=/partners/rider");

  const [rider, banks] = await Promise.all([getRiderApplication(), listBanks()]);

  return (
    <div className="mx-auto max-w-[760px]">
      <Eyebrow className="rise">Ride with Karrigo</Eyebrow>
      <h1 className="text-section-small md:text-section rise rise-1 mt-md mb-xl text-balance">
        {rider ? "Your rider application" : "Apply to ride"}
      </h1>
      <RiderApply rider={rider} banks={banks} firstName={customer.name.split(" ")[0] ?? ""} />
    </div>
  );
}
