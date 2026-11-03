"use client";

import { useState, useTransition } from "react";

import { saveStoreDetails } from "@/app/(order)/my-store/actions";
import { Saved, panel } from "@/components/kitchen/parts";
import { FormError, SubmitButton, field, fieldLabel } from "@/components/partners/parts";
import { cn } from "@/lib/cn";
import { DEFAULT_RIDER_BASE_FEE_NAIRA } from "@/lib/kitchen/types";

const RIDER_FEE_HELP = "Riders are paid at least this much per trip. Longer trips pay more by distance.";
const feeText = (kobo: number | null) => String(kobo == null ? DEFAULT_RIDER_BASE_FEE_NAIRA : Math.round(kobo / 100));

/** The store's name and the rider base fee. Location, payout account and the
 *  cover photo live on the setup page. */
export function StoreDetails({ name: savedName, riderBaseFeeKobo }: { name: string; riderBaseFeeKobo: number | null }) {
  const [name, setName] = useState(savedName);
  const [fee, setFee] = useState(feeText(riderBaseFeeKobo));
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, startTransition] = useTransition();

  const touch = () => {
    setError("");
    setDone("");
  };

  return (
    <form
      className={cn(panel, "gap-md flex flex-col")}
      onSubmit={(e) => {
        e.preventDefault();
        if (fee === "") return setError("Enter the rider base fee, like 1500.");
        startTransition(async () => {
          const result = await saveStoreDetails({ name, riderBaseFeeNaira: Number(fee) });
          if (!result.ok) return setError(result.error);
          setError("");
          setDone("Details saved.");
        });
      }}
    >
      <h2 className="text-h1 font-extrabold">Store details</h2>
      <label className={fieldLabel}>
        Store name
        <input value={name} onChange={(e) => { setName(e.target.value); touch(); }} className={field} />
      </label>
      <label id="rider-fee" className={fieldLabel}>
        Rider base delivery fee, ₦
        <input value={fee} onChange={(e) => { setFee(e.target.value.replace(/\D/g, "")); touch(); }} inputMode="numeric" placeholder="1500" className={field} />
      </label>
      <p className="text-site-label text-text-secondary -mt-sm">{RIDER_FEE_HELP}</p>
      <FormError>{error}</FormError>
      <Saved>{done}</Saved>
      <SubmitButton busy={busy} idle="Save details" working="Saving…" />
    </form>
  );
}
