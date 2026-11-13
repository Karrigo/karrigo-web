"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { changePassword, reportProblem, saveStaffPhone } from "@/app/(order)/my-kitchen/actions";
import { kitchenLogOut } from "@/app/(order)/partners/actions";
import { FormError, SubmitButton, field, fieldLabel } from "@/components/partners/parts";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { cn } from "@/lib/cn";
import { Saved, panel } from "./parts";

export function ProblemForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <form
      className={cn(panel, "gap-md flex flex-col")}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await reportProblem({ subject, body });
          if (!result.ok) return setError(result.error);
          setError("");
          setSubject("");
          setBody("");
          setDone("Sent to the Karrigo team. It's in your list below.");
        });
      }}
    >
      <div>
        <h2 className="text-h1 font-extrabold">Tell Karrigo about a problem</h2>
        <p className="text-site-label text-text-secondary mt-xs">
          A payout that looks wrong, a rider who didn&rsquo;t come, anything stopping you from cooking.
        </p>
      </div>
      <label className={fieldLabel}>
        What&rsquo;s wrong?
        <input value={subject} onChange={(e) => { setSubject(e.target.value); setError(""); setDone(""); }} maxLength={200} placeholder="The rider never came for my 2pm order" className={field} />
      </label>
      <label className={fieldLabel}>
        Details (optional)
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} className={cn(field, "resize-y")} />
      </label>
      <FormError>{error}</FormError>
      <Saved>{done}</Saved>
      <SubmitButton busy={busy} idle="Send to Karrigo" working="Sending…" />
    </form>
  );
}

export function AccountForms({ name, email, phone: savedPhone, kitchenName }: { name: string; email: string; phone: string; kitchenName: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(savedPhone);
  const [phoneError, setPhoneError] = useState("");
  const [phoneDone, setPhoneDone] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordDone, setPasswordDone] = useState("");
  const [savingPhone, startPhone] = useTransition();
  const [savingPassword, startPassword] = useTransition();
  const [, startLogOut] = useTransition();

  return (
    <section className={cn(panel, "gap-xl flex flex-col")}>
      <div>
        <h2 className="text-h1 font-extrabold">Your login</h2>
        <p className="text-site-label text-text-secondary mt-xs break-words">
          {name} · {email}
        </p>
      </div>

      <form
        className="gap-md flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          startPhone(async () => {
            const result = await saveStaffPhone(phone);
            if (!result.ok) return setPhoneError(result.error);
            setPhoneError("");
            setPhoneDone("We'll call this number about your orders.");
          });
        }}
      >
        <label className={fieldLabel}>
          Phone number Karrigo calls you on
          <input value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(""); setPhoneDone(""); }} type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" className={field} />
        </label>
        <FormError>{phoneError}</FormError>
        <Saved>{phoneDone}</Saved>
        <SubmitButton busy={savingPhone} idle="Save number" working="Saving…" />
      </form>

      <form
        className="border-surface-raised gap-md flex flex-col border-t pt-xl"
        onSubmit={(e) => {
          e.preventDefault();
          startPassword(async () => {
            const result = await changePassword({ currentPassword: current, newPassword: next });
            if (!result.ok) return setPasswordError(result.error);
            setPasswordError("");
            setCurrent("");
            setNext("");
            setPasswordDone("Password changed.");
          });
        }}
      >
        <label className={fieldLabel}>
          Current password
          <PasswordInput value={current} onChange={(e) => { setCurrent(e.target.value); setPasswordError(""); setPasswordDone(""); }} autoComplete="current-password" className={field} />
        </label>
        <label className={fieldLabel}>
          New password
          <PasswordInput value={next} onChange={(e) => { setNext(e.target.value); setPasswordError(""); setPasswordDone(""); }} autoComplete="new-password" className={field} />
        </label>
        <FormError>{passwordError}</FormError>
        <Saved>{passwordDone}</Saved>
        <SubmitButton busy={savingPassword} idle="Change password" working="Changing…" />
      </form>

      <button
        type="button"
        onClick={() =>
          startLogOut(async () => {
            await kitchenLogOut();
            router.push("/partners");
            router.refresh();
          })
        }
        className="text-text-secondary text-site-label self-start font-semibold"
      >
        Log out of {kitchenName}
      </button>
    </section>
  );
}
