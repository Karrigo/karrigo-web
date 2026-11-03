import type { Metadata } from "next";
import Link from "next/link";

import { panel } from "@/components/kitchen/parts";
import { VerificationPhotos } from "@/components/kitchen/VerificationPhotos";
import { StoreDetails } from "@/components/store/StoreDetails";
import { photoLockState } from "@/lib/photo-lock";
import { getStorePhotoUpdateRequest, listStoreVerificationPhotos } from "@/lib/partners/store-data";
import { STORE_APPLICATION, requireStoreOwner } from "@/lib/store/data";

export const metadata: Metadata = { title: "Details & photos · Your store · Karrigo" };

export default async function StoreSettingsPage() {
  const store = await requireStoreOwner();
  const [photos, updateRequest] = await Promise.all([listStoreVerificationPhotos(), getStorePhotoUpdateRequest()]);
  const lock = photoLockState(store.status, updateRequest);

  return (
    <div className="gap-lg flex flex-col">
      <StoreDetails name={store.name} riderBaseFeeKobo={store.riderBaseFeeKobo} />
      <section className={panel}>
        <h2 className="text-h1 font-extrabold mb-md">Store photos</h2>
        <VerificationPhotos
          side="store"
          photos={photos.photos}
          failed={photos.failed}
          canEdit
          lock={lock}
          unlockedUntil={updateRequest?.unlockedUntil ?? null}
        />
      </section>
      <p className="text-site-label text-text-secondary">
        Your location and payout account are on your{" "}
        <Link href={STORE_APPLICATION} className="text-accent-text font-bold">
          store setup page
        </Link>
        .
      </p>
    </div>
  );
}
