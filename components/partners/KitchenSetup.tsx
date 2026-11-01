"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  addDish,
  appealKitchen,
  kitchenLogOut,
  removeDish,
  saveKitchenBank,
  saveKitchenLocation,
  searchPlaces,
  uploadKitchenPhoto,
  type Place,
} from "@/app/(order)/partners/actions";
import { RiderFeeForm } from "@/components/kitchen/Settings";
import { SetupChecklist } from "@/components/kitchen/SetupChecklist";
import { VerificationPhotos } from "@/components/kitchen/VerificationPhotos";
import type { Schemas } from "@/lib/api/types";
import { VERIFICATION_PHOTOS_REQUIRED } from "@/lib/kitchen/types";
import { formatKobo } from "@/lib/money";
import type { Bank, KitchenApplication } from "@/lib/partners/types";
import { photoLockState, type PhotoUpdateRequest } from "@/lib/photo-lock";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { BankForm, FormError, PhotoUpload, StatusBanner, Step, SubmitButton, field, fieldLabel } from "./parts";

/**
 * A kitchen's application after sign-up: four things ops checks before
 * approving, each one a step that can be done in any order and come back to.
 * The banner at the top always says where the application stands.
 */
export function KitchenSetup({
  kitchen,
  banks,
  areas,
  photos,
  photosFailed = false,
  updateRequest = null,
}: {
  kitchen: KitchenApplication;
  banks: Bank[];
  areas: string[];
  photos: Schemas["VerificationPhotoResponseDto"][];
  /** The owner's photo list could not be read; fall back to the count. */
  photosFailed?: boolean;
  /** The latest photo-update request; drives the locked-photos banner. */
  updateRequest?: PhotoUpdateRequest;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // The owner's own list is exact; staff (or a failed list read) get the count.
  const photoCount = kitchen.isOwner && !photosFailed ? photos.length : kitchen.verificationPhotoCount;
  const photosDone = photoCount >= VERIFICATION_PHOTOS_REQUIRED;
  const feeDone = kitchen.riderBaseFeeKobo != null;

  const steps = [kitchen.hasLocation, !!kitchen.bankAccountName, !!kitchen.imageUrl, feeDone, photosDone, kitchen.dishes.length > 0];
  const left = steps.filter((done) => !done).length;

  const todo = [
    ...(kitchen.hasLocation ? [] : [{ label: "Set your kitchen's location", href: "#location" }]),
    ...(feeDone ? [] : [{ label: "Set the rider base delivery fee", href: "#rider-fee" }]),
    ...(photosDone ? [] : [{ label: `Kitchen photos: ${photoCount} of ${VERIFICATION_PHOTOS_REQUIRED}`, href: "#photos" }]),
  ];

  // A kitchen under review clears by itself the moment ops approves it.
  const pending = kitchen.status === "PENDING";
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [pending, router]);

  return (
    <div className="gap-lg flex flex-col">
      {kitchen.status === "ACTIVE" ? (
        <>
          <StatusBanner
            tone="live"
            title={`${kitchen.name} is live`}
            text="Customers can order from you. Open and close, take orders and run your menu from your kitchen page — it works on your phone."
          />
          <ButtonLink href="/my-kitchen" variant="accent" size="site" className="self-start">
            Run {kitchen.name}
          </ButtonLink>
        </>
      ) : kitchen.status === "SUSPENDED" ? (
        <>
          <StatusBanner
            tone="stopped"
            title={`${kitchen.name} isn't live`}
            text="Karrigo has suspended this kitchen, so customers can't see it. If you think that's wrong, or you've fixed the problem, send us one appeal."
            note={kitchen.note}
          />
          <Appeal sent={kitchen.appealNote} sentAt={kitchen.appealedAt} />
        </>
      ) : left > 0 ? (
        <StatusBanner
          tone="todo"
          title={`${left} thing${left === 1 ? "" : "s"} left before we can review ${kitchen.name}`}
          text="Finish the steps below. You can leave and come back — it's saved as you go."
        />
      ) : (
        <StatusBanner
          tone="waiting"
          title={`${kitchen.name} is with our team`}
          text="Everything we need is here. We'll review it and reach you on the number you gave us."
        />
      )}

      {kitchen.status === "PENDING" && <SetupChecklist items={todo} />}

      <div id="location" className="scroll-mt-xl">
      <Step
        number={1}
        title="Where is your kitchen?"
        done={kitchen.hasLocation}
        summary={[kitchen.area, kitchen.landmarkNote].filter(Boolean).join(" · ")}
        hint="Riders collect from here, and it decides which customers are close enough to order."
      >
        <LocationForm area={kitchen.area ?? ""} landmark={kitchen.landmarkNote ?? ""} areas={areas} />
      </Step>
      </div>

      <Step
        number={2}
        title="Where should we pay you?"
        done={!!kitchen.bankAccountName}
        summary={`${kitchen.bankAccountName} · account ending ${kitchen.bankAccountLast4}`}
        hint="Karrigo keeps 15% of what you sell. The rest is paid to this account."
      >
        <BankForm banks={banks} save={saveKitchenBank} />
      </Step>

      <Step
        number={3}
        title="A photo of your food"
        done={!!kitchen.imageUrl}
        summary="This is what customers see first."
        hint="One clear photo of a dish you're proud of. Daylight, no filter."
      >
        {kitchen.imageUrl && (
          <div className="bg-surface-raised relative mb-md aspect-[16/9] max-w-[360px] overflow-hidden rounded-panel-xs">
            <Image src={kitchen.imageUrl} alt={`${kitchen.name}'s photo`} fill sizes="360px" className="object-cover" />
          </div>
        )}
        <PhotoUpload label="Kitchen photo" done={!!kitchen.imageUrl} doneLabel="Photo added" upload={uploadKitchenPhoto} />
      </Step>

      <div id="rider-fee" className="scroll-mt-xl">
        <Step
          number={4}
          title="What do riders get paid?"
          done={feeDone}
          summary={feeDone ? `Riders get at least ${formatKobo(kitchen.riderBaseFeeKobo ?? 0)} per trip` : undefined}
          hint="Riders are paid at least this much per trip. Longer trips pay more by distance."
        >
          <RiderFeeForm riderBaseFeeKobo={kitchen.riderBaseFeeKobo} />
        </Step>
      </div>

      <div id="photos" className="scroll-mt-xl">
        <Step
          number={5}
          title="Kitchen photos"
          done={photosDone}
          summary={`${photoCount} of ${VERIFICATION_PHOTOS_REQUIRED} photos added`}
          hint="Our team looks at these before approving your kitchen."
        >
          {kitchen.isOwner ? (
            <VerificationPhotos
              side="kitchen"
              photos={photos}
              failed={photosFailed}
              canEdit
              lock={photoLockState(kitchen.status, updateRequest)}
              unlockedUntil={updateRequest?.unlockedUntil ?? null}
            />
          ) : (
            <p className="text-site-label text-text-secondary">
              {photoCount} of {VERIFICATION_PHOTOS_REQUIRED} added. Only the kitchen&rsquo;s owner can add or remove photos.
            </p>
          )}
        </Step>
      </div>

      <Step
        number={6}
        title="What's on the menu?"
        done={kitchen.dishes.length > 0}
        summary={`${kitchen.dishes.length} dish${kitchen.dishes.length === 1 ? "" : "es"} — ${kitchen.dishes
          .slice(0, 3)
          .map((d) => d.name)
          .join(", ")}${kitchen.dishes.length > 3 ? "…" : ""}`}
        hint="Add a few dishes to start. Photos, sections and sold-out switches are on your kitchen page once you are live."
      >
        <Dishes dishes={kitchen.dishes} canAdd={kitchen.hasLocation} />
      </Step>

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
        Log out of {kitchen.name}
      </button>
    </div>
  );
}

function LocationForm({ area: savedArea, landmark: savedLandmark, areas }: { area: string; landmark: string; areas: string[] }) {
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
      const result = await searchPlaces(query);
      if (!result.ok) return setError(result.error);
      setPlaces(result.places);
    });
  }

  function here() {
    if (!("geolocation" in navigator)) return setError("This phone can't share its location. Search for your street instead.");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => setPicked({ label: "Where you are standing now", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("We couldn't get your location. Search for your street instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form
      className="gap-md flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!picked) return setError("Find your kitchen first — search for it, or use your location if you're there now.");
        startSave(async () => {
          const result = await saveKitchenLocation({ lat: picked.lat, lng: picked.lng, area, landmarkNote: landmark });
          if (!result.ok) return setError(result.error);
          setError("");
        });
      }}
    >
      <div className={fieldLabel}>
        Find your kitchen
        <div className="gap-sm flex">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder="Street or a place nearby"
            aria-label="Street or a place nearby"
            className={field}
          />
          <button type="button" onClick={search} disabled={searching} className="bg-surface-raised rounded-pill text-nav-link shrink-0 px-lg font-bold disabled:opacity-50">
            {searching ? "…" : "Search"}
          </button>
        </div>
      </div>

      {places && places.length === 0 && (
        <p className="text-site-label text-text-secondary">Nothing found for that. Try a bigger street or a well-known place nearby.</p>
      )}
      {places && places.length > 0 && (
        <ul className="gap-xs flex flex-col">
          {places.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button
                type="button"
                onClick={() => setPicked(p)}
                className={cn(
                  "rounded-field text-site-label w-full border-[1.5px] px-lg py-md text-left font-semibold",
                  picked?.lat === p.lat && picked?.lng === p.lng ? "border-text bg-surface-raised" : "border-border-strong",
                )}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={here} className="text-accent-text text-site-label self-start font-bold">
        I&rsquo;m at the kitchen now — use my location
      </button>
      {picked && (
        <p className="bg-accent/15 text-accent-text rounded-field text-site-label px-lg py-md font-semibold">✓ {picked.label}</p>
      )}

      <label className={fieldLabel}>
        Area
        <select value={area} onChange={(e) => setArea(e.target.value)} className={cn(field, "appearance-none")}>
          <option value="">Pick your area</option>
          {[...new Set([...areas, ...(savedArea ? [savedArea] : [])])].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        Landmark for the rider
        <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Green gate opposite the Wadata mosque" className={field} />
      </label>

      <FormError>{error}</FormError>
      <SubmitButton busy={saving} idle="Save location" working="Saving…" />
    </form>
  );
}

function Dishes({ dishes, canAdd }: { dishes: KitchenApplication["dishes"]; canAdd: boolean }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="gap-lg flex flex-col">
      {dishes.length > 0 && (
        <ul>
          {dishes.map((d) => (
            <li key={d.id} className="border-surface-raised gap-md flex items-center justify-between border-b py-md last:border-b-0">
              <span className="text-site-question min-w-0 truncate">{d.name}</span>
              <span className="gap-md flex shrink-0 items-center">
                <span className="text-site-body font-bold">{formatKobo(d.priceKobo)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeDish(d.id);
                      if (!result.ok) setError(result.error);
                    })
                  }
                  className="text-text-secondary text-site-label font-semibold disabled:opacity-50"
                  aria-label={`Remove ${d.name}`}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <form
          className="gap-md flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await addDish({ name, description, priceNaira: Number(price) });
              if (!result.ok) return setError(result.error);
              setError("");
              setName("");
              setDescription("");
              setPrice("");
            });
          }}
        >
          <div className="gap-md grid sm:grid-cols-[2fr_1fr]">
            <label className={fieldLabel}>
              Dish
              <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Pounded yam & egusi" className={field} />
            </label>
            <label className={fieldLabel}>
              Price, ₦
              <input value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setError(""); }} inputMode="numeric" placeholder="2800" className={field} />
            </label>
          </div>
          <label className={fieldLabel}>
            What comes with it (optional)
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="With assorted meat" className={field} />
          </label>
          <FormError>{error}</FormError>
          <SubmitButton busy={busy} idle="Add dish" working="Adding…" />
        </form>
      ) : (
        <p className="text-site-label text-text-secondary">Set your kitchen&rsquo;s location in step 1 first — then you can add dishes.</p>
      )}
    </div>
  );
}

/** One appeal per suspension. Once sent it is shown back, read-only, until
 *  ops lifts the ban (which clears it) or bans again (which allows another). */
function Appeal({ sent, sentAt }: { sent: string | null; sentAt: string | null }) {
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
    <form
      className="bg-bg rounded-panel-sm p-xl gap-md flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await appealKitchen(message);
          setError(result.ok ? "" : result.error);
        });
      }}
    >
      <label className={fieldLabel}>
        Appeal this decision
        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setError(""); }}
          rows={4}
          maxLength={500}
          placeholder="What has changed, or why you think this is a mistake"
          className={cn(field, "resize-y")}
        />
      </label>
      <p className="text-site-chip text-text-secondary font-medium">
        You can send one appeal for this suspension · {500 - message.trim().length} characters left
      </p>
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} idle="Send appeal" working="Sending…" />
    </form>
  );
}
