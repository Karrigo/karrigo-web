"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  applyKitchen,
  applyStore,
  kitchenLogIn,
  storeLogIn,
  requestPartnerEmailOtp,
} from "@/app/(order)/partners/actions";
import { OtpInput } from "@/components/ui/OtpInput";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { Screen } from "@/components/ui/Screen";
import { cn } from "@/lib/cn";
import { FormError, SubmitButton, field, fieldLabel } from "./parts";

/**
 * The two partner onboardings, kitchen and store, share this form. Underneath
 * they are one sign-up: the same phone and email codes, the same login, one
 * business. What differs is the name of the thing, one extra question for a
 * kitchen, and where the owner is sent to sign in.
 */
export type PartnerSide = "kitchen" | "store";

const COPY = {
  kitchen: {
    heading: "Your kitchen",
    nameLabel: "Kitchen name",
    namePlaceholder: "Terkimbi's Kitchen",
    nameError: "What is your kitchen called?",
    areaError: "Pick the area your kitchen is in.",
    submit: "Start my application",
    working: "Setting up your kitchen…",
    loginHref: "/partners/kitchen/login",
    loginText: "Log in to your kitchen",
  },
  store: {
    heading: "Your store",
    nameLabel: "Store name",
    namePlaceholder: "Mama Ngozi Groceries",
    nameError: "What is your store called?",
    areaError: "Pick the area your store is in.",
    submit: "Start my application",
    working: "Setting up your store…",
    loginHref: "/partners/store/login",
    loginText: "Log in to your store",
  },
} as const;

/** One "we sent you a code" step: who it went to, what they typed, and when
 *  they may ask again. The phone and the email each have one. A code belongs
 *  to the exact thing it was sent to, so editing that thing starts over. */
function useCodeStep() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [wait, setWait] = useState(0);

  // Resend countdown. The timeout is cleared on every tick and on unmount.
  useEffect(() => {
    if (wait <= 0) return;
    const tick = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(tick);
  }, [wait]);

  return {
    sentTo,
    code,
    setCode,
    inputKey,
    wait,
    setWait,
    sent(to: string, cooldownSeconds: number) {
      setSentTo(to);
      setCode("");
      setInputKey((k) => k + 1);
      setWait(cooldownSeconds);
    },
    reset() {
      setSentTo(null);
      setCode("");
      setInputKey((k) => k + 1);
      setWait(0);
    },
  };
}

type FormState = {
  businessName: string;
  cuisine: string;
  areaId: string;
  name: string;
  email: string;
  password: string;
};

/**
 * The first screen of an application: who you are and what your business is
 * called. Everything slower (location, bank, photos) comes after, on a page
 * they can leave and come back to.
 */
export function PartnerApply({ side, areas }: { side: PartnerSide; areas: { id: string; name: string }[] }) {
  const copy = COPY[side];
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    businessName: "",
    cuisine: "",
    areaId: "",
    name: "",
    email: "",
    password: "",
  });
  // National digits from the two PhoneFields. Nothing verifies the number
  // (WhatsApp codes can't be sent yet), so it is typed twice.
  const [digits, setDigits] = useState("");
  const [confirmDigits, setConfirmDigits] = useState("");
  const emailStep = useCodeStep();
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const [sendingEmail, startSendingEmail] = useTransition();

  const phoneValid = digits.length === 10;
  const phonesMatch = digits === confirmDigits;
  const email = form.email.trim().toLowerCase();
  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const emailSent = emailStep.sentTo !== null && emailStep.sentTo === email;
  const noAreas = areas.length === 0;

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError("");
    // A code is for one address: changing it starts the step over.
    if (key === "email" && emailStep.sentTo !== e.target.value.trim().toLowerCase()) emailStep.reset();
  };

  function editPhone(next: string) {
    setDigits(next);
    setError("");
  }

  function sendEmailCode() {
    if (!emailValid) return setError("Add a valid email first.");
    const target = email;
    startSendingEmail(async () => {
      const result = await requestPartnerEmailOtp(target);
      if (!result.ok) {
        if (result.retryAfter) emailStep.setWait(result.retryAfter);
        return setError(result.error);
      }
      setError("");
      emailStep.sent(target, result.resendCooldownSeconds);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (form.businessName.trim().length < 2) return setError(copy.nameError);
    if (!form.areaId) return setError(copy.areaError);
    if (form.name.trim().length < 2) return setError("Add your own name.");
    if (!phoneValid) return setError("Add a valid phone number.");
    if (!emailValid) return setError("Add an email — it's how you'll log in.");
    if (form.password.length < 8) return setError("Password needs at least 8 characters.");
    if (!phonesMatch) return setError("The two phone numbers don't match.");
    if (!emailSent) return setError("Send a code to your email first.");
    if (!/^\d{6}$/.test(emailStep.code)) return setError("Enter the 6-digit code we emailed you.");

    const common = {
      name: form.name,
      email: form.email,
      password: form.password,
      areaId: form.areaId,
      phone: `+234${digits}`,
      emailOtpCode: emailStep.code,
    };
    startTransition(async () => {
      const result =
        side === "kitchen"
          ? await applyKitchen({ ...common, kitchenName: form.businessName, cuisine: form.cuisine })
          : await applyStore({ ...common, storeName: form.businessName });
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  const sendLabel = (step: ReturnType<typeof useCodeStep>, sending: boolean, sentOk: boolean) =>
    sending ? "Sending…" : step.wait > 0 ? `Send again in ${step.wait}s` : sentOk ? "Send a new code" : "Send code";

  return (
    <form onSubmit={submit} noValidate className="bg-bg rounded-panel-sm p-xl md:p-xxl gap-md flex flex-col">
      <h2 className="text-h1 font-extrabold">{copy.heading}</h2>
      <label className={fieldLabel}>
        {copy.nameLabel}
        <input value={form.businessName} onChange={set("businessName")} placeholder={copy.namePlaceholder} className={field} />
      </label>
      <div className={cn("gap-md grid", side === "kitchen" && "sm:grid-cols-2")}>
        {side === "kitchen" && (
          <label className={fieldLabel}>
            What you cook
            <input value={form.cuisine} onChange={set("cuisine")} placeholder="Swallow & soups" className={field} />
          </label>
        )}
        <label className={fieldLabel}>
          Area
          <select value={form.areaId} onChange={set("areaId")} disabled={noAreas} className={cn(field, "appearance-none")}>
            <option value="">Pick your area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {noAreas && (
        <p role="alert" className="text-danger-text text-site-label font-semibold">
          We couldn&rsquo;t load the areas — reload the page to try again.
        </p>
      )}

      <h2 className="text-h1 mt-md font-extrabold">You</h2>
      <label className={fieldLabel}>
        Your name
        <input value={form.name} onChange={set("name")} placeholder="Terkimbi Aondoakaa" autoComplete="name" className={field} />
      </label>
      <label className={fieldLabel}>
        Email
        <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" className={field} />
      </label>
      <div className="gap-md flex flex-wrap items-center">
        <button
          type="button"
          onClick={sendEmailCode}
          disabled={!emailValid || sendingEmail || emailStep.wait > 0}
          className="border-field-border text-site-button rounded-pill border-[1.5px] px-xl py-md font-bold transition-colors disabled:opacity-50"
        >
          {sendLabel(emailStep, sendingEmail, emailSent)}
        </button>
        {emailSent && <span className="text-site-label text-text-secondary">Code sent to {email}.</span>}
      </div>
      {emailSent && (
        <div className="gap-sm flex flex-col">
          <span className={fieldLabel}>Code from your email</span>
          <OtpInput
            key={emailStep.inputKey}
            name="emailOtpCode"
            error={Boolean(error)}
            onChange={(c) => {
              emailStep.setCode(c);
              setError("");
            }}
          />
        </div>
      )}
      <label className={fieldLabel}>
        Password
        <PasswordInput value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" className={field} />
      </label>

      <PhoneField label="Phone number" hint="We can't send a code to phones yet, so please check it carefully." onDigitsChange={editPhone} />
      <PhoneField
        label="Confirm phone number"
        error={confirmDigits.length === 10 && !phonesMatch ? "The two phone numbers don't match." : undefined}
        onDigitsChange={(next) => {
          setConfirmDigits(next);
          setError("");
        }}
      />

      <FormError>{error}</FormError>
      <SubmitButton busy={busy} disabled={noAreas} idle={copy.submit} working={copy.working} />
      <p className="text-site-label text-text-secondary">
        Already applied?{" "}
        <Link href={copy.loginHref} className="text-accent-text font-bold">
          {copy.loginText}
        </Link>
      </p>
    </form>
  );
}

const LOGIN_COPY = {
  kitchen: {
    title: "Log in to your kitchen",
    lead: "Use your business email and password. One login covers your kitchen and your store.",
    placeholder: "you@yourkitchen.com",
    // A live kitchen lands on its console; one still applying is sent on from
    // there to its application.
    after: "/my-kitchen",
    newText: "Apply to cook with Karrigo",
    newHref: "/partners/kitchen",
  },
  store: {
    title: "Log in to your store",
    lead: "Use your business email and password. One login covers your kitchen and your store.",
    placeholder: "you@yourstore.com",
    // An approved store opens its console; one still applying is sent on
    // from there to its application.
    after: "/my-store",
    newText: "Register your store",
    newHref: "/partners/store",
  },
} as const;

/** One partner login serves both onboardings; only the words and where you
 *  land afterwards differ. */
export function PartnerLogin({ side }: { side: PartnerSide }) {
  const [active, setActive] = useState<PartnerSide>(side);
  const copy = LOGIN_COPY[active];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="bg-bg rounded-panel-lg mx-auto grid max-w-[1000px] overflow-hidden md:grid-cols-2">
      <Screen
        mode="dark"
        className="p-xxl md:p-gap-wide gap-xxl relative flex flex-col justify-between overflow-hidden md:min-h-[420px]"
      >
        <div
          aria-hidden
          className="border-accent/20 pointer-events-none absolute top-[-150px] right-[-130px] size-[320px] rounded-full border-[1.5px]"
        />
        <div className="relative">
          <h1 className="text-panel-small md:text-panel text-cream text-balance">
            Open up.
            <br />
            <span className="text-accent-text">We&rsquo;re hungry for you.</span>
          </h1>
          <p className="text-panel-body text-cream/66 mt-lg max-w-[30ch]">
            Take orders, change today&rsquo;s prices and mark a dish sold out — all from your phone.
          </p>
        </div>
        <div className="rounded-step bg-surface relative hidden aspect-[16/10] overflow-hidden md:block">
          <Image
            src="/food/terkimbis-kitchen.jpg"
            alt="A kitchen plating up an order"
            fill
            sizes="(max-width: 768px) 100vw, 440px"
            className="object-cover"
          />
        </div>
      </Screen>

      <form
        noValidate
        className="p-xxl md:p-gap-wide gap-md flex flex-col justify-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim() || !password) return setError("Enter your email and password.");
          startTransition(async () => {
            const result = await (active === "store" ? storeLogIn : kitchenLogIn)(email, password);
            if (!result.ok) return setError(result.error);
            router.push(copy.after);
            router.refresh();
          });
        }}
      >
        {/* Same sliding switch as the customer log in. Both sides share one
            login, so this swaps the words in place instead of loading a page. */}
        <div className="bg-surface-raised rounded-pill relative flex p-xs">
          <span
            aria-hidden
            className={cn(
              "bg-bg rounded-pill absolute top-xs bottom-xs left-xs w-[calc(50%-4px)] shadow-[0_6px_14px_-8px_rgba(14,15,13,0.35)] transition-transform duration-(--duration-slow)",
              active === "store" && "translate-x-full",
            )}
          />
          {(["kitchen", "store"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={active === s}
              onClick={() => {
                setActive(s);
                setError("");
                // Keeps the address honest for a refresh or a shared link.
                window.history.replaceState(null, "", `/partners/${s}/login`);
              }}
              className="text-site-button relative flex-1 py-md text-center"
            >
              {s === "kitchen" ? "Kitchen" : "Store"}
            </button>
          ))}
        </div>
        <div className="mb-xs">
          <h2 className="text-h1 font-extrabold">{copy.title}</h2>
          <p className="text-site-label text-text-secondary mt-xs">
            {copy.lead}
          </p>
        </div>
        <label className={fieldLabel}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            autoComplete="email"
            placeholder={copy.placeholder}
            className={field}
          />
        </label>
        <label className={fieldLabel}>
          Password
          <PasswordInput
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            autoComplete="current-password"
            className={field}
          />
        </label>
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} idle="Log in" working="One moment…" />
        <p className="text-site-label text-text-secondary border-surface-raised mt-sm border-t pt-lg">
          New here?{" "}
          <Link href={copy.newHref} className="text-accent-text font-bold">
            {copy.newText}
          </Link>
        </p>
        <p className="text-site-label text-text-secondary">
          Riding instead?{" "}
          <Link href="/partners/rider" className="text-accent-text font-bold">
            Deliver with Karrigo
          </Link>
        </p>
      </form>
    </div>
  );
}
