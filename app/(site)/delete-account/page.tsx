import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { PageBody, PageIntro } from "@/components/site/PageIntro";
import { CONTACT, whatsappLink } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Delete your account — Karrigo",
  description: "How to ask Karrigo to delete your account and the data tied to it, and what we delete or keep.",
};

const UPDATED = "20 October 2026";

const IN_APP_STEPS = [
  "Open the Karrigo app (customers) or Karrigo Partner app (riders) and sign in.",
  "Open Help — in Karrigo it is in your account; in Karrigo Partner, go to Account, then Help & support.",
  "Tap “Delete my account”.",
  "Enter your password to confirm. Your account is deleted straight away.",
] as const;

const REQUEST_DETAILS = [
  "Which app you use: Karrigo (customer), Karrigo Partner (rider) or Karrigo Partner (kitchen or store)",
  "The phone number on your account, or the email for a kitchen or store account",
  "The words “Delete my account”",
] as const;

const REQUEST_TEMPLATE =
  "Hello Karrigo, please delete my account and its data.\n\nApp: \nPhone number or email on the account: ";

const DELETED = [
  "Your name, email address and profile photo.",
  "Your phone number is removed from the account, so the same number can be used to sign up again later.",
  "Your password and every signed-in session. You are signed out everywhere.",
  "Saved delivery addresses that no order uses.",
  "Notification settings and the device tokens used to send you notifications.",
  "For riders: vehicle plate number, guarantor details, and the licence, ID and vehicle registration documents you uploaded, including the stored files.",
] as const;

const KEPT = [
  "Your past orders, what you paid, and the delivery address each order used. Kitchens, stores and riders are paid from these records, and we need them for refunds, disputes and accounting. They are no longer linked to your name, phone number or email.",
  "For riders: bank payout details, so we can still pay anything owed to you.",
  "Records we must keep to meet legal and accounting duties.",
] as const;

export default function DeleteAccountPage() {
  const { whatsapp, email } = CONTACT;

  return (
    <PageBody width="760px">
      <PageIntro eyebrow={`Last updated ${UPDATED}`} title="Delete your Karrigo account">
        How to ask Karrigo to delete your account and the data tied to it, and exactly what we delete and
        keep. This applies to the Karrigo and Karrigo Partner apps.
      </PageIntro>

      <section id="steps" className="bg-bg rounded-panel-sm p-xl md:p-pad-card mt-xxl scroll-mt-xxl">
        <h2 className="text-site-title">Delete it yourself, in the app</h2>
        <p className="text-site-answer text-text-secondary mt-md max-w-[56ch]">
          The fastest way, for customers and riders. It takes under a minute.
        </p>
        <ol className="text-site-answer text-text-secondary mt-md gap-sm flex max-w-[56ch] list-decimal flex-col pl-xl">
          {IN_APP_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-site-label text-text-secondary mt-lg max-w-[56ch]">
          You cannot delete while an order is in progress, or while a rider is on a delivery. Finish or
          cancel it first, then try again.
        </p>
      </section>

      <section id="request" className="bg-bg rounded-panel-sm p-xl md:p-pad-card mt-xl scroll-mt-xxl">
        <h2 className="text-site-title">Cannot use the app? Ask us to do it</h2>
        <p className="text-site-answer text-text-secondary mt-md max-w-[56ch]">
          Use this if you have uninstalled the app, forgot your password, or have a kitchen or store account
          (those are deleted by our team, not in the app). Send us:
        </p>
        <ul className="text-site-answer text-text-secondary mt-sm gap-xs flex max-w-[56ch] list-disc flex-col pl-xl">
          {REQUEST_DETAILS.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>

        {whatsapp && (
          <ButtonLink href={whatsappLink(whatsapp, REQUEST_TEMPLATE)} variant="dark" size="site" className="mt-lg">
            Request deletion on WhatsApp
          </ButtonLink>
        )}
        {email && (
          <ButtonLink
            href={`mailto:${email}?subject=${encodeURIComponent("Delete my account")}&body=${encodeURIComponent(REQUEST_TEMPLATE)}`}
            variant={whatsapp ? "outline" : "dark"}
            size="site"
            className="mt-lg ml-0 sm:ml-md"
          >
            Request deletion by email
          </ButtonLink>
        )}
        {!whatsapp && !email && (
          <p className="text-site-answer text-text-secondary mt-lg max-w-[52ch]">
            Use the <Link href="/contact" className="text-accent-text underline">Contact page</Link> and
            include the details above.
          </p>
        )}
        <p className="text-site-label text-text-secondary mt-lg max-w-[56ch]">
          We may ask you to confirm you own the account before we delete it. We will tell you when it is
          done.
        </p>
      </section>

      <section id="deleted" className="bg-bg rounded-panel-sm p-xl md:p-pad-card mt-xl scroll-mt-xxl">
        <h2 className="text-site-title">What we delete</h2>
        <ul className="text-site-answer text-text-secondary mt-md gap-sm flex max-w-[56ch] list-disc flex-col pl-xl">
          {DELETED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="kept" className="bg-bg rounded-panel-sm p-xl md:p-pad-card mt-xl scroll-mt-xxl">
        <h2 className="text-site-title">What we keep, and for how long</h2>
        <ul className="text-site-answer text-text-secondary mt-md gap-sm flex max-w-[56ch] list-disc flex-col pl-xl">
          {KEPT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-site-answer text-text-secondary mt-md max-w-[56ch]">
          We keep these only for as long as we need them to settle payments, resolve disputes and meet our
          legal and accounting duties, as set out in our{" "}
          <Link href="/privacy#keep" className="text-accent-text underline">
            privacy policy
          </Link>
          .
        </p>
      </section>

      <p className="text-site-answer text-text-secondary mt-xxl">
        Deleting your account cannot be undone. See also our{" "}
        <Link href="/privacy" className="text-accent-text underline">
          privacy policy
        </Link>
        .
      </p>
    </PageBody>
  );
}
