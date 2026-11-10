import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTagSettings } from "@/app/(order)/actions";
import { TagSettings } from "@/components/order/TagSettings";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = { title: "Your tag · Karrigo", robots: { index: false } };

export default async function AccountPage() {
  if (!(await getCustomer())) redirect("/login?next=/account");
  const settings = await getTagSettings();

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="text-section-small md:text-section mt-sm mb-xl">Your tag</h1>
      {settings ? (
        <TagSettings initial={settings} />
      ) : (
        <p role="alert" className="text-danger-text text-site-body">
          We couldn&rsquo;t load your settings just now. Refresh to try again.
        </p>
      )}
    </div>
  );
}
