"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePhone } from "@/app/(order)/actions";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { firstIssue, phoneSchema } from "@/lib/order/schema";

const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)";

/**
 * The phone number riders call. No code is sent (there's no WhatsApp sender
 * yet): the number is typed twice to catch a slip, and replacing a saved one
 * asks for the password. Sign-up asks only for an email, so a number is added
 * here or at checkout.
 */
export function PhoneSettings({ initial }: { initial: { phone: string | null } }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, startTransition] = useTransition();

  const hasPhone = Boolean(initial.phone);

  function save() {
    const parsed = phoneSchema.safeParse({ phone, confirmPhone: confirm });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await savePhone(parsed.data.phone, hasPhone ? password : undefined);
      if (!result.ok) return setError(result.error);
      setPhone("");
      setConfirm("");
      setPassword("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col">
      <h2 className="text-h1 font-extrabold">Phone number</h2>
      <p className="text-site-label text-text-secondary">
        {hasPhone
          ? `Saved: ${initial.phone}. To change it, type the new number twice and enter your password.`
          : "Your rider calls this number when they reach you. Type it twice so we know it's right."}
      </p>
      <label className="text-label gap-sm flex flex-col font-bold">
        {hasPhone ? "New phone number" : "Phone number"}
        <input value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); setSaved(false); }} placeholder="0803 123 4567" inputMode="tel" autoComplete="tel" className={field} />
      </label>
      <label className="text-label gap-sm flex flex-col font-bold">
        Confirm phone number
        <input value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); setSaved(false); }} placeholder="Type it again" inputMode="tel" className={field} />
      </label>
      {hasPhone && (
        <label className="text-label gap-sm flex flex-col font-bold">
          Current password
          <PasswordInput value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="current-password" className={field} />
        </label>
      )}
      {error && <p role="alert" className="text-danger-text text-site-label font-semibold">{error}</p>}
      {saved && <p role="status" className="text-accent-text text-site-label font-semibold">Phone number saved.</p>}
      <Button type="button" variant="dark" size="site" onClick={save} disabled={busy || (hasPhone && password.length === 0)}>
        {busy ? "Saving…" : "Save number"}
      </Button>
    </section>
  );
}
