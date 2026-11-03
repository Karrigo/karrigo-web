"use client";

import { useOptimistic, useState, useTransition } from "react";

import { saveNotice, setOpen } from "@/app/(order)/my-kitchen/actions";
import { FormError, SubmitButton, field, fieldLabel } from "@/components/partners/parts";
import { cn } from "@/lib/cn";
import { Saved, Switch, panel } from "./parts";

/**
 * The kitchen's front door. Open means customers can order right now; closed
 * means the kitchen stays listed but takes nothing. It is the first thing on
 * the console because it is the first thing done every morning.
 */
export function Door({
  name,
  isOpen,
  canSwitch,
  onSetOpen = setOpen,
  place = "kitchen",
}: {
  name: string;
  isOpen: boolean;
  canSwitch: boolean;
  /** Opens or closes. A store has its own endpoint. */
  onSetOpen?: typeof setOpen;
  place?: "kitchen" | "store";
}) {
  const [open, setOptimistic] = useOptimistic(isOpen);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <section
      className={cn(
        // Not `panel`: it carries bg-bg, and with both backgrounds on one
        // element bg-bg won, leaving the open state's dark text on a dark card.
        "rounded-panel-sm p-xl md:p-xxl transition-colors duration-(--duration-normal)",
        open ? "bg-accent text-on-accent" : "bg-bg",
      )}
    >
      <div className="gap-lg flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-panel-small">{open ? "You're open" : "You're closed"}</h2>
          <p className={cn("text-site-body mt-xs", open ? "text-on-accent/75" : "text-text-secondary")}>
            {open
              ? `Customers can order from ${name} right now.`
              : `Nobody can order from ${name} until you open.`}
          </p>
        </div>
        {canSwitch && (
          <div className="shrink-0">
            <Switch
              size="lg"
              onAccent={open}
              checked={open}
              disabled={busy}
              label={open ? `Close ${name}` : `Open ${name}`}
              onChange={(next) => {
                setError("");
                startTransition(async () => {
                  setOptimistic(next);
                  const result = await onSetOpen(next);
                  if (!result.ok) setError(result.error);
                });
              }}
            />
          </div>
        )}
      </div>
      {!canSwitch && (
        <p className={cn("text-site-label mt-md", open ? "text-on-accent/75" : "text-text-secondary")}>
          Only the {place}&rsquo;s owner can open or close it.
        </p>
      )}
      {error && (
        <p role="alert" className="bg-bg text-danger-text rounded-field text-site-label mt-md px-lg py-md font-semibold">
          {error}
        </p>
      )}
    </section>
  );
}

/** One line customers see on the kitchen's page — "Egusi finishes by 3pm". */
export function Notice({ notice, onSave = saveNotice }: { notice: string; onSave?: typeof saveNotice }) {
  const [text, setText] = useState(notice);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <form
      className={cn(panel, "gap-md flex flex-col")}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await onSave(text);
          if (!result.ok) return setError(result.error);
          setError("");
          setSaved(text.trim() ? "Customers will see this on your page." : "Notice removed.");
        });
      }}
    >
      <label className={fieldLabel}>
        A note for customers today (optional)
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setError(""); setSaved(""); }}
          maxLength={140}
          placeholder="Fresh pepper soup from 2pm"
          className={field}
        />
      </label>
      <FormError>{error}</FormError>
      <Saved>{saved}</Saved>
      <SubmitButton busy={busy} idle="Save note" working="Saving…" />
    </form>
  );
}
