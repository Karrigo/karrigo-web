"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmEmailChange, requestEmailChange } from "@/app/(order)/actions";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { PasswordInput } from "@/components/ui/PasswordInput";

const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)";

/**
 * The account's email, proved with a code sent to it. An account that signed
 * up by phone (before email verification) can't reset its password until it
 * has one. The password is only needed once a verified email exists.
 */
export function EmailSettings({ initial }: { initial: { email: string | null; emailVerified: boolean } }) {
  const router = useRouter();
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [email, setEmail] = useState(initial.emailVerified ? "" : (initial.email ?? ""));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function send() {
    setError("");
    startTransition(async () => {
      const result = await requestEmailChange(email, password);
      if (!result.ok) return setError(result.error);
      setStep("code");
    });
  }

  function verify(code: string) {
    setError("");
    startTransition(async () => {
      const result = await confirmEmailChange(email, code);
      if (!result.ok) return setError(result.error);
      setStep("enter");
      setPassword("");
      router.refresh();
    });
  }

  return (
    <section className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col">
      <h2 className="text-h1 font-extrabold">Email</h2>
      <p className="text-site-label text-text-secondary">
        {initial.email
          ? `Currently ${initial.email}. Enter a new address and your password, and we'll send the address a code.`
          : "Used to reset your password if you forget it. We'll send a code to check it's yours."}
      </p>
      {step === "enter" ? (
        <>
          <label className="text-label gap-sm flex flex-col font-bold">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@example.com"
              autoComplete="email"
              className={field}
            />
          </label>
          {(
            <label className="text-label gap-sm flex flex-col font-bold">
              Current password
              <PasswordInput
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
                className={field}
              />
            </label>
          )}
          {error && <p role="alert" className="text-danger-text text-site-label font-semibold">{error}</p>}
          <Button type="button" variant="dark" size="site" onClick={send} disabled={busy || password.length === 0 || !/^\S+@\S+\.\S+$/.test(email.trim())}>
            {busy ? "Sending…" : "Send me a code"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-site-body">
            We emailed a 6-digit code to <strong>{email.trim()}</strong>.
          </p>
          <OtpInput error={Boolean(error)} onComplete={verify} />
          {error && <p role="alert" className="text-danger-text text-site-label font-semibold">{error}</p>}
          <button type="button" onClick={() => setStep("enter")} className="text-text-secondary text-site-label self-start font-semibold">
            ← Change email
          </button>
        </>
      )}
    </section>
  );
}
