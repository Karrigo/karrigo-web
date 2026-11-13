"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { confirmPhone, requestPhoneCode, savePhone } from "@/app/(order)/actions";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { firstIssue, phoneSchema } from "@/lib/order/schema";

const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)";

/**
 * The phone number riders call, proved with a WhatsApp code. Sign-up asks
 * only for an email, so a number is added here (or at checkout) and then
 * verified. Replacing a saved number asks for the password.
 */
export function PhoneSettings({ initial }: { initial: { phone: string | null; phoneVerified: boolean } }) {
  const router = useRouter();
  const [step, setStep] = useState<"enter" | "code">(initial.phone && !initial.phoneVerified ? "code" : "enter");
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [testCode, setTestCode] = useState<string | undefined>();
  const [busy, startTransition] = useTransition();
  const asked = useRef(false);

  const hasPhone = Boolean(initial.phone);
  const verified = hasPhone && initial.phoneVerified;

  function sendCode() {
    setError("");
    startTransition(async () => {
      const result = await requestPhoneCode();
      if (!result.ok) return setError(result.error);
      setTestCode(result.testCode);
    });
  }

  // A saved but unverified number: ask for the code as the page opens.
  useEffect(() => {
    if (step === "code" && !asked.current) {
      asked.current = true;
      sendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function save() {
    const parsed = phoneSchema.safeParse({ phone, confirmPhone: confirm });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setError("");
    startTransition(async () => {
      const result = await savePhone(parsed.data.phone, hasPhone ? password : undefined);
      if (!result.ok) return setError(result.error);
      setPhone("");
      setConfirm("");
      setPassword("");
      asked.current = false;
      setStep("code");
      router.refresh();
    });
  }

  function verify(code: string) {
    setError("");
    startTransition(async () => {
      const result = await confirmPhone(code);
      if (!result.ok) return setError(result.error);
      setStep("enter");
      router.refresh();
    });
  }

  return (
    <section className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col">
      <h2 className="text-h1 font-extrabold">Phone number</h2>
      <p className="text-site-label text-text-secondary">
        {verified
          ? `Verified: ${initial.phone}. Enter a new number and your password to change it.`
          : hasPhone
            ? `${initial.phone} isn't verified yet. We send a code on WhatsApp.`
            : "Your rider calls this number when they reach you. We'll send a code on WhatsApp to check it's yours."}
      </p>
      {step === "enter" ? (
        <>
          <label className="text-label gap-sm flex flex-col font-bold">
            Phone number
            <input value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} placeholder="0803 123 4567" inputMode="tel" autoComplete="tel" className={field} />
          </label>
          <label className="text-label gap-sm flex flex-col font-bold">
            Confirm phone number
            <input value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} placeholder="Type it again" inputMode="tel" className={field} />
          </label>
          {hasPhone && (
            <label className="text-label gap-sm flex flex-col font-bold">
              Current password
              <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="current-password" className={field} />
            </label>
          )}
          {error && <p role="alert" className="text-danger-text text-site-label font-semibold">{error}</p>}
          <Button type="button" variant="dark" size="site" onClick={save} disabled={busy || (hasPhone && password.length === 0)}>
            {busy ? "Saving…" : "Save and send code"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-site-body">
            We sent a 6-digit code to <strong>{initial.phone}</strong> on WhatsApp.
          </p>
          <OtpInput error={Boolean(error)} onComplete={verify} />
          {testCode && <p className="text-site-label text-text-secondary">Test mode: your code is <strong>{testCode}</strong>.</p>}
          {error && <p role="alert" className="text-danger-text text-site-label font-semibold">{error}</p>}
          <div className="gap-md flex">
            <button type="button" onClick={sendCode} disabled={busy} className="text-text-secondary text-site-label font-semibold">Send a new code</button>
            <button type="button" onClick={() => setStep("enter")} className="text-text-secondary text-site-label font-semibold">Change number</button>
          </div>
        </>
      )}
    </section>
  );
}
