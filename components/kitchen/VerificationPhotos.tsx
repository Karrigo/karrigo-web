"use client";

import { useState, useTransition } from "react";

import { deleteStorePhoto, requestStorePhotoUpdate, uploadStorePhoto } from "@/app/(order)/partners/actions";
import {
  deleteVerificationPhoto,
  requestKitchenPhotoUpdate,
  uploadVerificationPhoto,
} from "@/app/(order)/my-kitchen/actions";
import { FormError, PhotoUpload, SubmitButton, field, fieldLabel } from "@/components/partners/parts";
import type { Schemas } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { VERIFICATION_PHOTOS_REQUIRED } from "@/lib/kitchen/types";
import type { PhotoLockState } from "@/lib/photo-lock";

/**
 * The 6 photos ops checks before approving a kitchen or store. Only the owner
 * can add or remove them (karrigo-be refuses staff), so staff see them
 * read-only. Approval locks the set: the owner then sees a banner with a
 * reasoned update-request form instead of the add/remove controls, until an
 * approved request re-opens editing. The URLs are signed and short-lived: the
 * page that renders this reads them fresh on every load.
 */
export function VerificationPhotos({
  side,
  photos,
  canEdit,
  failed = false,
  lock = "editable",
  unlockedUntil = null,
}: {
  side: "kitchen" | "store";
  photos: Schemas["VerificationPhotoResponseDto"][];
  canEdit: boolean;
  /** The list could not be read: say so here rather than show "0 of 6". */
  failed?: boolean;
  /** From the vendor status plus the latest update request; pages compute it. */
  lock?: PhotoLockState;
  /** Set while an approved update request keeps editing open. */
  unlockedUntil?: string | null;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const full = photos.length >= VERIFICATION_PHOTOS_REQUIRED;
  const label = side === "kitchen" ? "kitchen" : "store";
  const upload = side === "kitchen" ? uploadVerificationPhoto : uploadStorePhoto;
  const remove = side === "kitchen" ? deleteVerificationPhoto : deleteStorePhoto;
  const photosEditable = canEdit && (lock === "editable" || lock === "unlocked");

  if (failed) {
    return (
      <p role="alert" className="text-danger-text text-site-label font-semibold">
        Couldn&rsquo;t load your photos — reload to try again.
      </p>
    );
  }

  return (
    <div className="gap-md flex flex-col">
      <p className="text-site-label text-text-secondary">
        Add {VERIFICATION_PHOTOS_REQUIRED} clear photos of your {label}: the front, the work area, storage, and the inside.
      </p>
      <p className="text-site-label font-bold">
        {photos.length} of {VERIFICATION_PHOTOS_REQUIRED} added
      </p>

      {photos.length > 0 && (
        <ul className="gap-md grid grid-cols-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="gap-sm flex flex-col">
              <div className="bg-surface-raised aspect-[4/3] overflow-hidden rounded-panel-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; next/image would proxy and cache it. */}
                <img src={photo.url} alt={`${side === "kitchen" ? "Kitchen" : "Store"} photo ${index + 1}`} className="size-full object-cover" />
              </div>
              {photosEditable &&
                (confirming === photo.id ? (
                  <div className="gap-sm flex flex-wrap items-center">
                    <span className="text-site-label font-semibold">Remove this photo?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await remove(photo.id);
                          setConfirming(null);
                          setError(result.ok ? "" : result.error);
                        })
                      }
                      className="text-danger-text text-site-label font-bold disabled:opacity-50"
                    >
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                      className="text-text-secondary text-site-label font-semibold disabled:opacity-50"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setConfirming(photo.id);
                    }}
                    aria-label={`Remove ${label} photo ${index + 1}`}
                    className="text-text-secondary text-site-label self-start font-semibold disabled:opacity-50"
                  >
                    Remove
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      <FormError>{error}</FormError>

      {photosEditable ? (
        <>
          {lock === "unlocked" && unlockedUntil ? (
            <p className="text-site-label text-text-secondary">
              Photo update approved — you can change your photos until{" "}
              {new Date(unlockedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
            </p>
          ) : null}
          <PhotoUpload
            label={`Add ${label} photos`}
            done={false}
            doneLabel=""
            idleText={full ? "You have all 6 photos. Remove one to swap it." : `${VERIFICATION_PHOTOS_REQUIRED - photos.length} more to add`}
            buttonLabel={VERIFICATION_PHOTOS_REQUIRED - photos.length > 1 ? "Add photos" : "Add photo"}
            disabled={full}
            multiple
            maxFiles={VERIFICATION_PHOTOS_REQUIRED - photos.length}
            upload={upload}
          />
        </>
      ) : canEdit && lock === "locked" ? (
        <PhotoUpdateRequestForm side={side} />
      ) : canEdit && lock === "pending" ? (
        <p className="text-site-label text-text-secondary">
          Your photo update request is pending review — your photos stay as they are until then.
        </p>
      ) : (
        <p className="text-site-label text-text-secondary">Only the business owner can add or remove these photos.</p>
      )}
    </div>
  );
}

/** The reasoned form an approved owner uses to ask support to unlock the set. */
function PhotoUpdateRequestForm({ side }: { side: "kitchen" | "store" }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, startTransition] = useTransition();
  const request = side === "kitchen" ? requestKitchenPhotoUpdate : requestStorePhotoUpdate;

  if (sent) {
    return (
      <div className="bg-bg rounded-panel-sm p-xl">
        <p className="text-site-title">Request sent · awaiting a decision</p>
        <p className="text-site-label text-text-secondary mt-xs">
          Karrigo&rsquo;s team will unlock your photos for 7 days if they agree.
        </p>
      </div>
    );
  }

  return (
    <form
      className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await request(reason);
          if (result.ok) {
            setSent(true);
            setError("");
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <p className="text-site-title">Photos locked</p>
      <p className="text-site-label text-text-secondary">
        Approval locks these photos. Tell us why you need new ones and we&rsquo;ll unlock them for 7 days.
      </p>
      <label className={fieldLabel}>
        Why do you need to change your photos?
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError("");
          }}
          rows={4}
          maxLength={1000}
          placeholder="For example: we repainted the shopfront"
          className={cn(field, "resize-y")}
        />
      </label>
      <p className="text-site-chip text-text-secondary font-medium">
        You can only have one request at a time · {1000 - reason.trim().length} characters left
      </p>
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} idle="Request photo update" working="Sending…" />
    </form>
  );
}
