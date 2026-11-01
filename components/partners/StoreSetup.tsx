"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  appealStore,
  kitchenLogOut,
  saveStoreBank,
  saveStoreFee,
  saveStoreLocation,
  searchStorePlaces,
  type Place,
} from "@/app/(order)/partners/actions";
import { SetupChecklist } from "@/components/kitchen/SetupChecklist";
import { VerificationPhotos } from "@/components/kitchen/VerificationPhotos";
import type { Schemas } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { DEFAULT_RIDER_BASE_FEE_NAIRA, VERIFICATION_PHOTOS_REQUIRED } from "@/lib/kitchen/types";
import { formatKobo } from "@/lib/money";
import { storeSetupProgress } from "@/lib/partners/store-setup";
import type { Bank, StoreApplication } from "@/lib/partners/types";
import { photoLockState, type PhotoUpdateRequest } from "@/lib/photo-lock";
import { AppealAnswer, BankForm, FormError, StatusBanner, Step, SubmitButton, field, fieldLabel } from "./parts";

export function StoreSetup({
  store,
  banks,
  areas,
  photos,
  photosFailed = false,
  updateRequest = null,
}: {
  store: StoreApplication;
  banks: Bank[];
  areas: string[];
  photos: Schemas["StoreVerificationPhotoResponseDto"][];
  photosFailed?: boolean;
  /** The latest photo-update request; drives the locked-photos banner. */
  updateRequest?: PhotoUpdateRequest;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const photoCount = store.isOwner && !photosFailed ? photos.length : store.verificationPhotoCount;
  const progress = storeSetupProgress(store, photoCount);
  const locationDone = !store.missing.includes("LOCATION");
  const feeDone = !store.missing.includes("RIDER_FEE");

  useEffect(() => {
    if (store.status !== "PENDING") return;
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router, store.status]);

  return (
    <div className="gap-lg flex flex-col">
      {store.status === "ACTIVE" ? (
        <StatusBanner
          tone="live"
          title={`${store.name} is approved`}
          text="Your store setup is approved. Product listings and store orders are coming next."
        />
      ) : store.status === "SUSPENDED" ? (
        <>
          <StatusBanner
            tone="stopped"
            title={store.neverApproved ? `${store.name} wasn't approved` : `${store.name} has been suspended`}
            text={
              store.neverApproved
                ? "Karrigo didn't approve this store. Review the note below, fix what needs attention, then send an appeal."
                : "Karrigo has suspended this store. Review the note below, fix what needs attention, then send an appeal."
            }
            note={store.note}
          />
          {store.isOwner ? (
            <StoreAppeal sent={store.appealNote} sentAt={store.appealedAt} response={store.appealResponse} />
          ) : (
            <OwnerMessage action="send an appeal" />
          )}
        </>
      ) : progress.left > 0 ? (
        <StatusBanner
          tone="todo"
          title={`${progress.left} thing${progress.left === 1 ? "" : "s"} left before we can review ${store.name}`}
          text="Finish the steps below. You can leave and come back — it's saved as you go."
        />
      ) : (
        <StatusBanner
          tone="waiting"
          title={`${store.name} is with our team`}
          text="Everything we need is here. We'll review it and reach the owner on the number they gave us."
        />
      )}

      {store.status === "PENDING" && <SetupChecklist items={progress.items} />}

      <div id="location" className="scroll-mt-xl">
        <Step
          number={1}
          title="Where is your store?"
          done={locationDone}
          summary={[store.area, store.landmarkNote].filter(Boolean).join(" · ")}
          hint="Riders collect from here, and it decides which customers are close enough to order."
        >
          {store.isOwner ? (
            <StoreLocationForm area={store.area ?? ""} landmark={store.landmarkNote ?? ""} areas={areas} />
          ) : (
            <OwnerMessage action="change the store location" />
          )}
        </Step>
      </div>

      <div id="rider-fee" className="scroll-mt-xl">
        <Step
          number={2}
          title="What do riders get paid?"
          done={feeDone}
          summary={feeDone ? `Riders get at least ${formatKobo(store.riderBaseFeeKobo ?? 0)} per trip` : undefined}
          hint="Riders are paid at least this much per trip. Longer trips pay more by distance."
        >
          {store.isOwner ? (
            <StoreFeeForm riderBaseFeeKobo={store.riderBaseFeeKobo} />
          ) : (
            <OwnerMessage action="set the rider fee" />
          )}
        </Step>
      </div>

      <div id="payout" className="scroll-mt-xl">
        <Step
          number={3}
          title="Where should we pay you?"
          done={Boolean(store.bankAccountName)}
          summary={
            store.bankAccountName
              ? `${store.bankAccountName} · account ending ${store.bankAccountLast4 ?? ""}`
              : undefined
          }
          hint="This account belongs to your business. If your kitchen already set it, it is ready here too."
        >
          {store.isOwner ? <BankForm banks={banks} save={saveStoreBank} /> : <OwnerMessage action="change the payout account" />}
        </Step>
      </div>

      <div id="photos" className="scroll-mt-xl">
        <Step
          number={4}
          title="Store photos"
          done={progress.photosDone}
          summary={`${photoCount} of ${VERIFICATION_PHOTOS_REQUIRED} photos added`}
          hint="Our team checks these before approving your store. Kitchen photos do not count here."
        >
          {store.isOwner ? (
            <VerificationPhotos
              side="store"
              photos={photos}
              failed={photosFailed}
              canEdit
              lock={photoLockState(store.status, updateRequest)}
              unlockedUntil={updateRequest?.unlockedUntil ?? null}
            />
          ) : (
            <p className="text-site-label text-text-secondary">
              {photoCount} of {VERIFICATION_PHOTOS_REQUIRED} added. Only the business owner can add or remove photos.
            </p>
          )}
        </Step>
      </div>

      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await kitchenLogOut();
            router.push("/partners");
            router.refresh();
          })
        }
        className="text-text-secondary text-site-label self-start font-semibold"
      >
        Log out of {store.name}
      </button>
    </div>
  );
}

function OwnerMessage({ action }: { action: string }) {
  return <p className="text-site-label text-text-secondary">Only the business owner can {action}. Ask them to log in.</p>;
}

function StoreLocationForm({
  area: savedArea,
  landmark: savedLandmark,
  areas,
}: {
  area: string;
  landmark: string;
  areas: string[];
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [picked, setPicked] = useState<Place | null>(null);
  const [area, setArea] = useState(savedArea);
  const [landmark, setLandmark] = useState(savedLandmark);
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  function search() {
    setError("");
    startSearch(async () => {
      const result = await searchStorePlaces(query);
      if (!result.ok) return setError(result.error);
      setPlaces(result.places);
    });
  }

  function here() {
    if (!("geolocation" in navigator)) {
      return setError("This phone can't share its location. Search for your street instead.");
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setPicked({
          label: "Where you are standing now",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => setError("We couldn't get your location. Search for your street instead."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <form
      className="gap-md flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!picked) return setError("Find your store first — search for it, or use your location if you're there now.");
        if (!area) return setError("Pick the area your store is in.");
        startSave(async () => {
          const result = await saveStoreLocation({
            lat: picked.lat,
            lng: picked.lng,
            area,
            landmarkNote: landmark,
          });
          setError(result.ok ? "" : result.error);
        });
      }}
    >
      <div className={fieldLabel}>
        Find your store
        <div className="gap-sm flex">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
            placeholder="Street or a place nearby"
            aria-label="Street or a place nearby"
            className={field}
          />
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="bg-surface-raised rounded-pill text-nav-link shrink-0 px-lg font-bold disabled:opacity-50"
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
      </div>

      {places?.length === 0 && (
        <p className="text-site-label text-text-secondary">
          Nothing found for that. Try a bigger street or a well-known place nearby.
        </p>
      )}
      {places && places.length > 0 && (
        <ul className="gap-xs flex flex-col">
          {places.map((place) => (
            <li key={`${place.lat},${place.lng}`}>
              <button
                type="button"
                onClick={() => setPicked(place)}
                className={cn(
                  "rounded-field text-site-label w-full border-[1.5px] px-lg py-md text-left font-semibold",
                  picked?.lat === place.lat && picked?.lng === place.lng
                    ? "border-text bg-surface-raised"
                    : "border-border-strong",
                )}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={here} className="text-accent-text text-site-label self-start font-bold">
        I&rsquo;m at the store now — use my location
      </button>
      {picked && (
        <p className="bg-accent/15 text-accent-text rounded-field text-site-label px-lg py-md font-semibold">
          ✓ {picked.label}
        </p>
      )}

      <label className={fieldLabel}>
        Area
        <select
          value={area}
          onChange={(event) => setArea(event.target.value)}
          className={cn(field, "appearance-none")}
        >
          <option value="">Pick your area</option>
          {[...new Set([...areas, ...(savedArea ? [savedArea] : [])])].map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        Landmark for the rider
        <input
          value={landmark}
          onChange={(event) => setLandmark(event.target.value)}
          placeholder="Blue gate beside the pharmacy"
          className={field}
        />
      </label>

      <FormError>{error}</FormError>
      <SubmitButton busy={saving} idle="Save location" working="Saving…" />
    </form>
  );
}

function StoreFeeForm({ riderBaseFeeKobo }: { riderBaseFeeKobo: number | null }) {
  const [fee, setFee] = useState(
    String(riderBaseFeeKobo == null ? DEFAULT_RIDER_BASE_FEE_NAIRA : Math.round(riderBaseFeeKobo / 100)),
  );
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <form
      className="gap-md flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!fee) return setError("Enter the rider base fee, like 1500.");
        startTransition(async () => {
          const result = await saveStoreFee(Number(fee));
          setError(result.ok ? "" : result.error);
        });
      }}
    >
      <label className={fieldLabel}>
        Rider base delivery fee, ₦
        <input
          value={fee}
          onChange={(event) => {
            setFee(event.target.value.replace(/\D/g, ""));
            setError("");
          }}
          inputMode="numeric"
          placeholder="1500"
          className={field}
        />
      </label>
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} idle="Save fee" working="Saving…" />
    </form>
  );
}

function StoreAppeal({ sent, sentAt, response }: { sent: string | null; sentAt: string | null; response: string | null }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  if (sentAt) {
    return (
      <div className="bg-bg rounded-panel-sm p-xl">
        <p className="text-site-title">Appeal sent · awaiting a decision</p>
        <p className="text-site-label text-text-secondary mt-xs">
          Sent {new Date(sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}.
          Karrigo&rsquo;s team will lift the suspension if they agree.
        </p>
        {sent && <p className="bg-surface-raised rounded-field text-site-label mt-md px-lg py-md font-semibold">“{sent}”</p>}
      </div>
    );
  }

  return (
    <>
    {response && <AppealAnswer response={response} />}
    <form
      className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await appealStore(message);
          setError(result.ok ? "" : result.error);
        });
      }}
    >
      <label className={fieldLabel}>
        Appeal this decision
        <textarea
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setError("");
          }}
          rows={4}
          maxLength={500}
          placeholder="What has changed, or why you think this is a mistake"
          className={cn(field, "resize-y")}
        />
      </label>
      <p className="text-site-chip text-text-secondary font-medium">
        If we decline, you can appeal again · {500 - message.trim().length} characters left
      </p>
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} idle={response ? "Appeal again" : "Send appeal"} working="Sending…" />
    </form>
    </>
  );
}
