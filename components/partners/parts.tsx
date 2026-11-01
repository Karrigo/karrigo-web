"use client";

import { useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import type { Bank } from "@/lib/partners/types";
import { planPhotoBatch } from "@/lib/photo-batch";
import { shrinkImage } from "@/lib/shrink-image";

export const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg w-full border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)";
export const fieldLabel = "text-label flex flex-col gap-sm font-bold";

type Result = { ok: true } | { ok: false; error: string };

export function FormError({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-danger-text text-site-label shake font-semibold">
      {children}
    </p>
  );
}

/**
 * One step of an application. Done steps collapse to a single line saying
 * what was saved, with a way back in — someone fixing a rejected application
 * should see at a glance which part ops is asking about.
 */
export function Step({
  number,
  title,
  done,
  summary,
  hint,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  /** What was saved, shown when the step is collapsed. */
  summary?: string;
  /** Why we ask, shown when the step is open. */
  hint?: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const open = !done || editing;

  return (
    <section className="bg-bg rounded-panel-sm p-xl md:p-xxl">
      <div className="gap-md flex items-start">
        <span
          className={cn(
            "text-label grid size-[28px] shrink-0 place-items-center rounded-full font-extrabold",
            done ? "bg-accent text-on-accent" : "bg-surface-raised text-text-secondary",
          )}
        >
          {done ? "✓" : number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="gap-md flex flex-wrap items-baseline justify-between">
            <h2 className="text-h1 font-extrabold">{title}</h2>
            {done && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="text-accent-text text-site-label font-bold"
              >
                {editing ? "Close" : "Change"}
              </button>
            )}
          </div>
          {done && !editing && summary && (
            <p className="text-site-label text-text-secondary mt-xs break-words">{summary}</p>
          )}
          {open && hint && <p className="text-site-label text-text-secondary mt-xs">{hint}</p>}
          {open && <div className="mt-lg">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/**
 * Bank and account number. On success the backend returns the account
 * holder's name from the bank, which is shown back — "is this you?" — because
 * a mistyped digit that happens to be someone else's account is how a payout
 * goes to a stranger.
 */
export function BankForm({
  banks,
  save,
}: {
  banks: Bank[];
  save: (bankCode: string, accountNumber: string) => Promise<({ ok: true } & { accountName: string | null }) | { ok: false; error: string }>;
}) {
  const [bankCode, setBankCode] = useState("");
  const [account, setAccount] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (banks.length === 0) {
    return <FormError>We couldn&apos;t load the list of banks just now. Refresh the page to try again.</FormError>;
  }

  return (
    <form
      className="gap-md flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        setConfirmed(null);
        startTransition(async () => {
          const result = await save(bankCode, account);
          if (!result.ok) return setError(result.error);
          setError("");
          setConfirmed(result.accountName ?? "Saved");
        });
      }}
    >
      <label className={fieldLabel}>
        Bank
        <select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setError(""); }} className={cn(field, "appearance-none")}>
          <option value="">Pick your bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        Account number
        <input
          value={account}
          onChange={(e) => { setAccount(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
          inputMode="numeric"
          placeholder="10 digits"
          className={field}
        />
      </label>
      <FormError>{error}</FormError>
      {confirmed && (
        <p className="bg-accent/15 text-accent-text rounded-field text-site-label px-lg py-md font-semibold">
          ✓ {confirmed}. Payouts go to this account.
        </p>
      )}
      <SubmitButton busy={busy} idle="Check and save account" working="Checking with the bank…" />
    </form>
  );
}

export function SubmitButton({
  busy,
  idle,
  working,
  disabled = false,
}: {
  busy: boolean;
  idle: string;
  working: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="bg-text text-bg rounded-pill text-site-button self-start px-xl py-md font-bold transition-transform duration-(--duration-fast) active:scale-95 disabled:opacity-50"
    >
      {busy ? working : idle}
    </button>
  );
}

/**
 * A photo picker that uploads as soon as a file is chosen. `capture` opens
 * the camera on a phone, which is where most applicants are — the licence is
 * in their hand, not in their gallery.
 */
export function PhotoUpload({
  label,
  done,
  doneLabel,
  fields,
  camera = false,
  upload,
  idleText = "Not added yet",
  buttonLabel,
  disabled = false,
  multiple = false,
  maxFiles,
}: {
  label: string;
  done: boolean;
  doneLabel: string;
  /** Extra form fields sent with the file, such as the document kind. */
  fields?: Record<string, string>;
  camera?: boolean;
  upload: (form: FormData) => Promise<Result>;
  /** What the status line says before anything is added. */
  idleText?: string;
  /** Overrides the button text, for a control that adds rather than replaces. */
  buttonLabel?: string;
  disabled?: boolean;
  /** Let one pick carry several photos (verification sets). Single-photo slots leave this off. */
  multiple?: boolean;
  /** Cap for one pick; extras are left out with a note. Defaults to 1 for single picks, unlimited for multiple. */
  maxFiles?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  return (
    <div className="border-surface-raised gap-md flex flex-wrap items-center justify-between border-b py-md last:border-b-0">
      <div className="min-w-0">
        <div className="text-site-question">{label}</div>
        <div className={cn("text-site-label mt-xs", error ? "text-danger-text font-semibold" : "text-text-secondary")}>
          {error ||
            (progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : busy ? "Uploading…" : done ? `✓ ${doneLabel}` : idleText)}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        {...(camera ? { capture: "environment" as const } : {})}
        {...(multiple ? { multiple: true } : {})}
        className="sr-only"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length === 0) return;
          // One at a time unless the caller opted into a batch; a cap
          // keeps the pick within the set's remaining slots.
          const limit = maxFiles ?? (multiple ? picked.length : 1);
          const { take, skipped } = planPhotoBatch(picked.length, 0, limit);
          const batch = picked.slice(0, take);
          if (batch.length === 0) return;
          setError("");
          setProgress({ done: 0, total: batch.length });
          startTransition(async () => {
            let failed = "";
            for (const [index, raw] of batch.entries()) {
              setProgress({ done: index, total: batch.length });
              const file = await shrinkImage(raw);
              const form = new FormData();
              for (const [k, v] of Object.entries(fields ?? {})) form.set(k, v);
              form.set("file", file, file.name);
              const result = await upload(form);
              if (!result.ok && !failed) failed = result.error;
            }
            setProgress(null);
            if (failed) setError(failed);
            else if (skipped > 0)
              setError(
                `Added ${batch.length} — ${skipped} extra ${skipped === 1 ? "photo wasn't" : "photos weren't"} needed.`,
              );
          });
        }}
      />
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => input.current?.click()}
        className={cn(
          "rounded-pill text-nav-link shrink-0 px-xl py-md font-bold disabled:opacity-50",
          done ? "bg-surface-raised text-text" : "bg-accent text-on-accent",
        )}
      >
        {buttonLabel ?? (done ? "Replace" : camera ? "Take photo" : "Choose photo")}
      </button>
    </div>
  );
}

/** The state of the application, said plainly, with ops' note when there is one. */
export function StatusBanner({
  tone,
  title,
  text,
  note,
  noteLabel = "From Karrigo",
}: {
  tone: "waiting" | "live" | "stopped" | "todo";
  title: string;
  text: string;
  note?: string | null;
  noteLabel?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-panel-sm p-xl",
        tone === "live" && "bg-accent/15",
        tone === "stopped" && "bg-danger-bg",
        (tone === "waiting" || tone === "todo") && "bg-bg",
      )}
    >
      <p className={cn("text-site-title", tone === "stopped" && "text-danger-text", tone === "live" && "text-accent-text")}>
        {title}
      </p>
      <p className="text-site-body text-text-secondary mt-xs">{text}</p>
      {note && (
        <p className="bg-bg text-text rounded-field text-site-label mt-md px-lg py-md font-semibold">
          {noteLabel}: “{note}”
        </p>
      )}
    </div>
  );
}

/** Ops' answer to an appeal they declined. Shown above the appeal form: the
 *  suspension stands, and the owner can reply with another appeal. */
export function AppealAnswer({ response }: { response: string }) {
  return (
    <div className="bg-bg rounded-panel-sm p-xl">
      <p className="text-site-title">We reviewed your appeal</p>
      <p className="text-site-label text-text-secondary mt-xs">It stays as it is for now. You can appeal again.</p>
      <p className="bg-surface-raised rounded-field text-site-label mt-md px-lg py-md font-semibold">“{response}”</p>
    </div>
  );
}
