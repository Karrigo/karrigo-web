import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTagSettings } from "@/app/(order)/actions";
import { EmailSettings } from "@/components/order/EmailSettings";
import { PhoneSettings } from "@/components/order/PhoneSettings";
import { TagSettings } from "@/components/order/TagSettings";
import { getCustomer } from "@/lib/shop/session";

export const metadata: Metadata = { title: "Your account · Karrigo", robots: { index: false } };

export default async function AccountPage() {
  if (!(await getCustomer())) redirect("/login?next=/account");
  const settings = await getTagSettings();

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="text-section-small md:text-section mt-sm mb-xl">Your account</h1>
      {"error" in settings ? (
        <div role="alert" className="text-danger-text text-site-body">
          <p>{settings.message ?? "We couldn’t load your settings just now. Refresh to try again."}</p>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-site-label mt-sm font-mono">Dev only: {settings.error}</p>
          )}
        </div>
      ) : (
        <div className="gap-xl flex flex-col">
          <EmailSettings initial={{ email: settings.email, emailVerified: settings.emailVerified }} />
          <PhoneSettings initial={{ phone: settings.phone, phoneVerified: settings.phoneVerified }} />
          <TagSettings initial={settings} />
        </div>
      )}
    </div>
  );
}
