import type { Metadata } from "next";
import Link from "next/link";

import { HoursForm, ProfileForm, SidesForm } from "@/components/kitchen/Settings";
import { VerificationPhotos } from "@/components/kitchen/VerificationPhotos";
import { panel } from "@/components/kitchen/parts";
import { APPLICATION, getHours, getKitchenPhotoUpdateRequest, listVerificationPhotos, requireOwner } from "@/lib/kitchen/data";
import { photoLockState } from "@/lib/photo-lock";

export const metadata: Metadata = { title: "Hours & details · Your kitchen · Karrigo" };

export default async function KitchenSettingsPage() {
  const kitchen = await requireOwner();
  const [hours, photos, updateRequest] = await Promise.all([
    getHours(),
    listVerificationPhotos(),
    getKitchenPhotoUpdateRequest(),
  ]);
  const lock = photoLockState(kitchen.status, updateRequest);

  return (
    <div className="gap-lg flex flex-col">
      <SidesForm servesFood={kitchen.servesFood} servesGrocery={kitchen.servesGrocery} />
      <HoursForm days={hours.days} everSaved={hours.saved} />
      <ProfileForm name={kitchen.name} cuisine={kitchen.cuisine} riderBaseFeeKobo={kitchen.riderBaseFeeKobo} />
      <section className={panel}>
        <h2 className="text-h1 font-extrabold mb-md">Kitchen photos</h2>
        <VerificationPhotos
          side="kitchen"
          photos={photos.photos}
          failed={photos.failed}
          canEdit
          lock={lock}
          unlockedUntil={updateRequest?.unlockedUntil ?? null}
        />
      </section>
      <p className="text-site-label text-text-secondary">
        Your location, payout account and cover photo are on your{" "}
        <Link href={APPLICATION} className="text-accent-text font-bold">
          kitchen setup page
        </Link>
        .
      </p>
    </div>
  );
}
