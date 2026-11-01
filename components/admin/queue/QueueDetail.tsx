"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import {
  balanceFields,
  payoutKobo,
  queueStatusLabel,
  type QueueItem,
  type QueueKind,
  type QueueStatus,
} from "@/lib/admin/queue";
import type { AdminRole } from "@/lib/admin/types";
import { Eyebrow, StatusChip, type Tone } from "@/components/admin/ui";
import { VERIFICATION_PHOTOS_REQUIRED, photosNeededText } from "@/lib/kitchen/types";
import { kitchenDetail, riderDocumentUrl, storePhotos } from "@/app/(admin)/admin/queue-actions";
import { KitchenProducts } from "./KitchenProducts";

type Decision = "approve" | "reject" | "suspend" | "payout" | "declineAppeal";

const TONE: Record<QueueStatus, Tone> = {
  PENDING: "warning",
  ACTIVE: "success",
  APPROVED: "success",
  SUSPENDED: "danger",
  REJECTED: "danger",
};

/**
 * One application, and the decision about it.
 *
 * Every decision goes through a confirm step that says what will happen in
 * plain words — who can order from them straight away, what the rider will
 * see, how much money leaves and that it cannot be undone. Rejecting and
 * suspending require a reason, because the applicant is shown it and "you
 * were rejected" with no reason is how we lose a kitchen that only needed to
 * re-photograph a licence.
 */
export function QueueDetail({
  kind,
  item,
  role,
  onDecide,
  onDeclineAppeal,
  onSetRequiresCac,
  onPayout,
  busy,
}: {
  kind: QueueKind;
  item: QueueItem;
  role: AdminRole;
  onDecide: (item: QueueItem, status: QueueStatus, note: string) => void;
  /** Answer an appeal without lifting the suspension; the owner may appeal again. */
  onDeclineAppeal: (item: QueueItem, response: string) => void;
  onSetRequiresCac: (item: QueueItem, requiresCac: boolean) => void;
  onPayout?: () => void;
  busy: boolean;
}) {
  const [pending, setPending] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState<{
    title: string;
    url: string | null;
    error: string | null;
  } | null>(null);
  const [viewingGuarantor, setViewingGuarantor] = useState(false);
  /** The owner's login and dish count, which only the detail endpoint has. */
  const [more, setMore] = useState<{
    id: string;
    fields: { key: string; value: string }[];
    menuItems: number;
    photos: { id: string; url: string }[];
    /** Kitchens only: what is on file, so the checklist can say what's missing. */
    hasOwnerPhoto: boolean | null;
    hasCacDocument: boolean | null;
  } | null>(null);

  useEffect(() => {
    if (kind === "riders") return;
    let cancelled = false;
    if (kind === "kitchens") {
      kitchenDetail(item.id).then((result) => {
        if (!cancelled && result.ok) {
          setMore({
            id: item.id,
            fields: result.fields,
            menuItems: result.menuItems,
            photos: result.photos,
            hasOwnerPhoto: result.hasOwnerPhoto,
            hasCacDocument: result.hasCacDocument,
          });
        }
      });
    } else {
      storePhotos(item.id).then((result) => {
        if (!cancelled && result.ok) {
          setMore({ id: item.id, fields: [], menuItems: 0, photos: result.photos, hasOwnerPhoto: null, hasCacDocument: null });
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [kind, item.id]);

  async function openDocument(which: "license" | "id" | "vehicleReg", label: string) {
    const title = `${label} · ${item.title}`;
    setViewing({ title, url: null, error: null });
    const result = await riderDocumentUrl(item.id, which);
    setViewing({
      title,
      url: result.ok ? result.url : null,
      error: result.ok ? null : result.error,
    });
  }

  const isKitchen = kind === "kitchens";
  const isStore = kind === "stores";
  const isPartner = isKitchen || isStore;
  const noun = isKitchen ? "kitchen" : isStore ? "store" : "rider";
  const net = payoutKobo(item);

  function reset() {
    setPending(null);
    setNote("");
  }

  const confirm = pending ? describe(pending) : null;

  function describe(decision: Decision) {
    switch (decision) {
      case "approve":
        return {
          title:
            item.status === "SUSPENDED" && !item.neverApproved
              ? `Put ${item.title} back live?`
              : `Approve ${item.title}?`,
          text: isKitchen
            ? `Customers in ${item.fields[0].value} can order from them straight away.`
            : isStore
              ? "The store setup is approved. Products and ordering remain unavailable until that catalogue launches."
            : item.guarantor
              ? "They can go online and receive trip offers."
              : "They can go online and receive trip offers. No guarantor's form is on file yet.",
          button:
            isPartner && item.status === "SUSPENDED" ? (item.neverApproved ? "Approve" : "Reactivate") : "Approve",
          tone: "go" as const,
          requiresNote: false,
          run: () =>
            onDecide(item, isPartner ? "ACTIVE" : "APPROVED", note.trim()),
        };
      case "reject":
        return item.status === "APPROVED"
          ? {
              title: `Ask ${item.title} to update their documents?`,
              text: "Approved documents are locked. This unlocks them and sends your note to the rider. They can't go online again until they resubmit and you approve.",
              button: "Send request",
              tone: "bad" as const,
              requiresNote: true,
              run: () => onDecide(item, "REJECTED", note.trim()),
            }
          : {
              title: `Reject ${item.title}?`,
              text: isPartner
                ? `The ${noun} is marked suspended. Add a note so they know what to fix.`
                : "The rider sees this note in the app and can re-upload.",
              button: "Reject",
              tone: "bad" as const,
              requiresNote: true,
              run: () => onDecide(item, isPartner ? "SUSPENDED" : "REJECTED", note.trim()),
            };
      case "suspend":
        return {
          title: `Suspend ${item.title}?`,
          text: "They disappear from the customer app until reactivated. Open orders still complete.",
          button: "Suspend",
          tone: "bad" as const,
          requiresNote: true,
          run: () => onDecide(item, "SUSPENDED", note.trim()),
        };
      case "declineAppeal":
        return {
          title: `Decline ${item.title}'s appeal?`,
          text: `The ${noun} stays ${item.neverApproved ? "rejected" : "suspended"}. The owner is emailed your answer, sees it in the app, and can appeal again. To accept the appeal, ${item.neverApproved ? "approve" : "reactivate"} instead.`,
          button: "Send answer",
          tone: "dark" as const,
          requiresNote: true,
          run: () => onDeclineAppeal(item, note.trim()),
        };
      case "payout":
        return {
          title: `Send ${formatKobo(net)} to ${item.title}?`,
          text: isKitchen
            ? "Settles every unpaid completed order in one Paystack transfer. This can't be undone."
            : `${formatKobo(item.unpaidKobo)} trip pay minus ${formatKobo(
                item.cashHeldKobo,
              )} cash already held. One Paystack transfer, can't be undone.`,
          button: `Send ${formatKobo(net)}`,
          tone: "dark" as const,
          requiresNote: false,
          run: () => {
            onPayout?.();
            reset();
          },
        };
    }
  }

  const actions: { label: string; decision: Decision; tone: "go" | "bad" | "dark" }[] =
    [];
  if (item.status === "PENDING") {
    actions.push({
      label: isPartner ? "Approve and go live" : "Approve rider",
      decision: "approve",
      tone: "go",
    });
    actions.push({
      label: isPartner ? "Reject" : "Reject with note",
      decision: "reject",
      tone: "bad",
    });
  }
  if (item.status === "ACTIVE" || item.status === "APPROVED") {
    // Only a super admin moves money. The server action checks this too —
    // hiding the button is the courtesy, not the control.
    if (!isStore && net > 0 && item.payable && role === "SUPER_ADMIN") {
      actions.push({
        label: `Pay out ${formatKobo(net)}`,
        decision: "payout",
        tone: "dark",
      });
    }
    if (isPartner) {
      actions.push({ label: `Suspend ${noun}`, decision: "suspend", tone: "bad" });
    } else if (item.status === "APPROVED") {
      actions.push({ label: "Request document changes", decision: "reject", tone: "bad" });
    }
  }
  if (item.status === "SUSPENDED") {
    actions.push({
      label: item.neverApproved ? `Approve ${noun}` : `Reactivate ${noun}`,
      decision: "approve",
      tone: "go",
    });
    if (isPartner && item.appeal) {
      actions.push({ label: "Decline appeal", decision: "declineAppeal", tone: "bad" });
    }
  }

  const extra = more?.id === item.id ? more : null;
  const fields = [
    ...(extra?.fields ?? []),
    ...item.fields,
    ...balanceFields(kind, item),
  ];
  const photos = extra?.photos ?? null;
  // Only known once the detail has loaded; the server refuses regardless.
  const approveBlocked =
    isPartner && photos !== null && photos.length < VERIFICATION_PHOTOS_REQUIRED
      ? photosNeededText(photos.length)
      : null;
  const checks = extra
    ? [
        ...item.checks,
        ...(isKitchen && photos
          ? [{ label: `${photos.length} of ${VERIFICATION_PHOTOS_REQUIRED} kitchen photos`, ok: photos.length >= VERIFICATION_PHOTOS_REQUIRED }]
          : []),
        ...(isKitchen && extra.hasOwnerPhoto !== null ? [{ label: "Owner's photo", ok: extra.hasOwnerPhoto }] : []),
        ...(isKitchen && item.requiresCac && extra.hasCacDocument !== null
          ? [{ label: "CAC certificate (required)", ok: extra.hasCacDocument }]
          : []),
        ...(isKitchen ? [{
          label: extra.menuItems ? `${extra.menuItems} dishes on the menu` : "No dishes yet",
          ok: extra.menuItems > 0,
        }] : []),
      ]
    : item.checks;
  const blocked = !!confirm?.requiresNote && !note.trim();

  return (
    <div
      data-theme="light"
      className="bg-ops-surface text-text overflow-hidden rounded-[15px]"
    >
      <header className="border-text/8 flex items-start justify-between gap-3 border-b px-[22px] py-lg">
        <div className="min-w-0">
          <h2 className="truncate text-[20px]/none font-extrabold tracking-[-0.03em]">
            {item.title}
          </h2>
          <p className="text-text/62 mt-2 text-[12.5px]">{item.sub}</p>
        </div>
        <StatusChip tone={TONE[item.status]}>
          {queueStatusLabel(item)}
        </StatusChip>
      </header>

      {item.appeal && (
        <div className="bg-warning-bg border-text/8 border-b px-[22px] py-3 text-[12.5px]/[1.5]">
          <p className="font-semibold">Appeal from the owner · {item.appeal.at}</p>
          {item.appeal.note && <p className="text-text/85 mt-1">{item.appeal.note}</p>}
        </div>
      )}

      {!item.appeal && item.appealResponse && (
        <div className="bg-text/6 border-text/8 border-b px-[22px] py-3 text-[12.5px]/[1.5]">
          <p className="font-semibold">You declined their appeal{item.appealResponse.at ? ` · ${item.appealResponse.at}` : ""}</p>
          <p className="text-text/85 mt-1">{item.appealResponse.note}</p>
          <p className="text-text/62 mt-1">They can appeal again.</p>
        </div>
      )}

      {item.note && (
        <p className="bg-danger-bg text-text/85 border-text/8 border-b px-[22px] py-3 text-[12.5px]/[1.5]">
          {item.note}
        </p>
      )}

      <dl className="border-text/8 grid grid-cols-2 gap-x-3 gap-y-3.5 border-b px-[22px] py-lg">
        {fields.map((field) => (
          <div key={field.key} className="flex min-w-0 flex-col gap-1">
            <Eyebrow className="text-[10.5px]">{field.key}</Eyebrow>
            <dd className="truncate text-[13px] font-semibold">{field.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="border-text/8 flex flex-col gap-2.5 border-b px-[22px] py-lg">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid size-5 flex-none place-items-center rounded-full text-[12px] font-bold",
                check.ok
                  ? "bg-success-bg text-success"
                  : "bg-warning-bg text-warning",
              )}
            >
              {check.ok ? "✓" : "!"}
            </span>
            <span className="flex-1 text-[13px]">{check.label}</span>
            {check.document === "guarantor" ? (
              <button
                type="button"
                disabled={!check.ok}
                onClick={() => setViewingGuarantor(true)}
                className="text-accent-text text-[12px] font-semibold disabled:opacity-40"
              >
                View
              </button>
            ) : (
              check.document &&
              check.ok && (
                <button
                  type="button"
                  onClick={() => openDocument(check.document as "license" | "id" | "vehicleReg", check.label)}
                  className="text-accent-text text-[12px] font-semibold"
                >
                  View
                </button>
              )
            )}
          </li>
        ))}
      </ul>

      {isPartner && item.status !== "ACTIVE" && (
        <div className="border-text/8 flex items-center justify-between gap-3 border-b px-[22px] py-3">
          <span className="text-[13px]">
            {item.requiresCac
              ? "CAC certificate required before approval"
              : "CAC certificate is optional"}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSetRequiresCac(item, !item.requiresCac)}
            className="text-accent-text text-[12px] font-semibold disabled:opacity-40"
          >
            {item.requiresCac ? "Make optional" : "Require it"}
          </button>
        </div>
      )}

      {isPartner && photos && photos.length > 0 && (
        <div className="border-text/8 border-b px-[22px] py-lg">
          <Eyebrow className="text-[10.5px]">
            {isKitchen ? "Kitchen" : "Store"} photos · {photos.length} of {VERIFICATION_PHOTOS_REQUIRED}
          </Eyebrow>
          <ul className="mt-2.5 grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  aria-label={`Open ${noun} photo ${index + 1}`}
                  onClick={() =>
                    setViewing({ title: `${isKitchen ? "Kitchen" : "Store"} photo ${index + 1} · ${item.title}`, url: photo.url, error: null })
                  }
                  className="bg-text/6 block aspect-[4/3] w-full overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; next/image would proxy and cache it. */}
                  <img src={photo.url} alt={`${isKitchen ? "Kitchen" : "Store"} photo ${index + 1}`} className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isKitchen && item.status !== "PENDING" && <KitchenProducts kitchenId={item.id} />}

      {confirm ? (
        <div className="flex flex-col gap-2.5 px-[22px] py-lg">
          <div
            className={cn(
              "flex flex-col gap-2.5 rounded-[15px] p-3.5",
              confirm.tone === "bad"
                ? "bg-danger-bg"
                : confirm.tone === "go"
                  ? "bg-accent/14"
                  : "bg-text/6",
            )}
          >
            <span className="text-[13.5px] font-semibold">{confirm.title}</span>
            <span className="text-text/80 text-[12.5px]/[1.5]">{confirm.text}</span>
            {(pending === "reject" || pending === "suspend" || pending === "declineAppeal") && (
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder={
                  pending === "declineAppeal"
                    ? "Your answer (required) · the owner reads it"
                    : pending === "reject" && item.status === "APPROVED"
                    ? "What needs to change? (required)"
                    : confirm.requiresNote
                      ? `Reason (required) · the ${noun} sees this`
                      : "Reason (optional)"
                }
                className="border-text/16 bg-ops-surface text-text placeholder:text-text/45 rounded-xl border px-3 py-2 text-[12.5px] outline-none"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={blocked || busy}
                onClick={confirm.run}
                className={cn(
                  "h-9 rounded-pill px-lg text-[12.5px] font-bold disabled:opacity-40",
                  confirm.tone === "bad"
                    ? "bg-danger text-ops-surface"
                    : confirm.tone === "go"
                      ? "bg-accent text-on-accent"
                      : "bg-text text-ops-surface",
                )}
              >
                {confirm.button}
              </button>
              <button
                type="button"
                onClick={reset}
                className="border-text/16 text-text h-9 rounded-pill border px-lg text-[12.5px] font-semibold"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      ) : (
        actions.length > 0 && (
          <div className="flex flex-wrap gap-2 px-[22px] py-lg">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={action.decision === "approve" && !!approveBlocked}
                onClick={() => {
                  setPending(action.decision);
                  setNote("");
                }}
                className={cn(
                  "h-10 rounded-pill px-[18px] text-[13px] font-bold",
                  action.tone === "go"
                    ? "bg-accent text-on-accent"
                    : action.tone === "dark"
                      ? "bg-text text-ops-surface"
                      : "border-danger/30 text-danger border",
                  "disabled:opacity-40",
                )}
              >
                {action.label}
              </button>
            ))}
            {approveBlocked && actions.some((a) => a.decision === "approve") && (
              <p role="status" className="text-warning w-full text-[12.5px] font-semibold">
                {approveBlocked}
              </p>
            )}
          </div>
        )
      )}

      {viewingGuarantor && item.guarantor && (
        <div
          data-anim="fade"
          className="bg-scrim fixed inset-0 z-50 grid place-items-center p-lg"
          onClick={() => setViewingGuarantor(false)}
        >
          <div
            className="bg-ops-surface flex w-[min(420px,100%)] flex-col gap-3 rounded-[20px] p-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold">Guarantor&rsquo;s form · {item.title}</span>
              <button
                type="button"
                onClick={() => setViewingGuarantor(false)}
                className="text-text/62 text-[13px] font-semibold"
              >
                Close
              </button>
            </div>
            <dl className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <Eyebrow className="text-[10.5px]">Name</Eyebrow>
                <dd className="text-[14px] font-semibold">{item.guarantor.name}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <Eyebrow className="text-[10.5px]">Phone</Eyebrow>
                <dd className="text-[14px] font-semibold">
                  <a href={`tel:${item.guarantor.phone}`} className="text-accent-text">
                    {item.guarantor.phone}
                  </a>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <Eyebrow className="text-[10.5px]">Address</Eyebrow>
                <dd className="text-[14px] font-semibold">{item.guarantor.address}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {viewing && (
        <div
          data-anim="fade"
          className="bg-scrim fixed inset-0 z-50 grid place-items-center p-lg"
          onClick={() => setViewing(null)}
        >
          <div className="bg-ops-surface flex w-[min(520px,100%)] flex-col gap-3 rounded-[20px] p-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold">{viewing.title}</span>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="text-text/62 text-[13px] font-semibold"
              >
                Close
              </button>
            </div>
            <div className="bg-text/6 text-text/62 grid min-h-[280px] place-items-center overflow-hidden rounded-[15px] text-[13px]">
              {viewing.error ? (
                <span className="px-lg text-center">{viewing.error}</span>
              ) : viewing.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; next/image would proxy and cache an identity document.
                <img src={viewing.url} alt={viewing.title} className="max-h-[60vh] w-full object-contain" />
              ) : (
                "Opening…"
              )}
            </div>
            {viewing.url && (
              <a
                href={viewing.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent-text text-[12.5px] font-semibold"
              >
                Open in a new tab (PDFs and large files)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
