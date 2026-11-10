"use client";

import { useState, useTransition } from "react";
import { saveTag, setAllowOrdersFromOthers, type TagSettings as Settings } from "@/app/(order)/actions";
import { Button } from "@/components/ui/Button";

const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)";

const FORMAT = /^[a-z0-9_]{3,20}$/;

/** The customer's shareable tag, and whether other people may send them orders. */
export function TagSettings({ initial }: { initial: Settings }) {
  const [tag, setTag] = useState(initial.tag);
  const [draft, setDraft] = useState(initial.tag ?? "");
  const [allow, setAllow] = useState(initial.allowOrdersFromOthers);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const clean = draft.trim().replace(/^@+/, "").toLowerCase();
  const changed = clean !== (tag ?? "");

  function save() {
    setError("");
    setMessage("");
    startSaving(async () => {
      const result = await saveTag(clean);
      if (!result.ok) return setError(result.error);
      setTag(result.tag);
      setDraft(result.tag);
      setMessage(`Your tag is @${result.tag}`);
    });
  }

  function toggle(next: boolean) {
    const previous = allow;
    setAllow(next);
    setError("");
    void setAllowOrdersFromOthers(next).then((result) => {
      if (!result.ok) {
        setAllow(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="gap-xl flex flex-col">
      <section className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col">
        <label className="text-label gap-sm flex flex-col font-bold">
          Your tag
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(""); setMessage(""); }}
            placeholder="@terkimbi_k"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={21}
            className={field}
          />
        </label>
        <p className="text-site-label text-text-secondary">
          {tag
            ? "Friends enter this to send you an order. You can change it once every 30 days."
            : "Pick a tag so friends can send you an order. 3–20 letters, numbers or underscores."}
        </p>
        {error && <p role="alert" className="text-danger-text text-site-label font-semibold">{error}</p>}
        {message && <p className="text-accent-text text-site-label font-semibold">{message}</p>}
        {changed && clean.length > 0 && (
          <Button type="button" variant="dark" size="site" onClick={save} disabled={saving || !FORMAT.test(clean)}>
            {saving ? "Saving…" : tag ? "Change tag" : "Save tag"}
          </Button>
        )}
      </section>

      <section className="bg-bg rounded-panel-sm p-xl">
        <label className="gap-md flex items-start justify-between">
          <span>
            <span className="text-site-body block font-bold">Let others send me orders</span>
            <span className="text-site-label text-text-secondary mt-xs block">
              When off, nobody can send you an order, even with your tag.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={allow}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-xs size-5 shrink-0"
          />
        </label>
      </section>
    </div>
  );
}
