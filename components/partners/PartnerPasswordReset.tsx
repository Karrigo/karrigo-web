"use client";

import { useEffect, useState, useTransition } from "react";

import { requestPartnerPasswordReset, resetPartnerPassword } from "@/app/(order)/partners/actions";
import { OtpInput } from "@/components/ui/OtpInput";
import { resetInputIssue, type PartnerResetSide } from "@/lib/partners/password-reset";
import { FormError, SubmitButton, field, fieldLabel } from "./parts";

/**
 * A kitchen or store owner who has forgotten their password: email, then the
 * code we sent and a new password. It replaces the login form in place, and
 * hands back to it (with a note) once the password is changed.
 */
export function PartnerPasswordReset({
  side,
  initialEmail,
  onBack,
  onDone,
}: {
  side: PartnerResetSide;
  initialEmail: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeKey, setCodeKey] = useState(0);
  const [password, setPassword] = useState("");
  const [wait, setWait] = useState(0);
  const [error, setError] = useState("");
  const [sending, startSending] = useTransition();
  const [busy, startTransition] = useTransition();

  // Resend countdown, shown as a number so "wait a bit" is not a guess.
  useEffect(() => {
    if (wait <= 0) return;
    const tick = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(tick);
  }, [wait]);

  const target = email.trim().toLowerCase();
  const codeSent = sentTo !== null && sentTo === target;

  function sendCode() {
    const issue = resetInputIssue({ email: target });
    if (issue) return setError(issue);
    startSending(async () => {
      const result = await requestPartnerPasswordReset(side, target);
      if (!result.ok) {
        if (result.retryAfter) setWait(result.retryAfter);
        return setError(result.error);
      }
      setError("");
      setSentTo(target);
      setCode("");
      setCodeKey((k) => k + 1);
      setWait(result.resendCooldownSeconds);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || sending) return;
    if (!codeSent) return sendCode();

    const issue = resetInputIssue({ email: target, code, password });
    if (issue) return setError(issue);
    startTransition(async () => {
      const result = await resetPartnerPassword(side, { email: target, code, password });
      if (!result.ok) return setError(result.error);
      onDone();
    });
  }

  return (
    <form noValidate onSubmit={submit} className="p-xxl md:p-gap-wide gap-md flex flex-col justify-center">
      <div className="mb-xs">
        <h2 className="text-h1 font-extrabold">Reset your password</h2>
        <p className="text-site-label text-text-secondary mt-xs">
          We&rsquo;ll email a 6-digit code to the address you log in with, then you choose a new password.
        </p>
      </div>

      <label className={fieldLabel}>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          autoComplete="email"
          placeholder={side === "store" ? "you@yourstore.com" : "you@yourkitchen.com"}
          className={field}
        />
      </label>

      {codeSent && (
        <>
          <div className="gap-sm rise flex flex-col">
            <p className="text-site-label text-text-secondary">
              If <strong className="text-text">{sentTo}</strong> has a Karrigo account, a code is on its way. Check
              spam too.
            </p>
            <OtpInput
              key={codeKey}
              error={Boolean(error)}
              onChange={(next) => {
                setCode(next);
                setError("");
              }}
            />
          </div>
          <label className={fieldLabel}>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={field}
            />
          </label>
        </>
      )}

      <FormError>{error}</FormError>

      <div className="gap-md flex flex-wrap items-center">
        <SubmitButton
          busy={busy || sending}
          idle={codeSent ? "Change password" : "Send reset code"}
          working={sending ? "Sending…" : "One moment…"}
        />
        {codeSent && (
          <button
            type="button"
            disabled={wait > 0 || sending || busy}
            onClick={sendCode}
            className="text-accent-text text-site-label font-bold disabled:opacity-50"
          >
            {wait > 0 ? `Send again in ${wait}s` : "Send a new code"}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-accent-text text-site-label border-surface-raised mt-sm self-start border-t pt-lg font-bold"
      >
        ← Back to log in
      </button>
    </form>
  );
}
