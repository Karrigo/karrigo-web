import type { Metadata } from "next";

import { AddOtherSide } from "@/components/partners/AddOtherSide";
import { Eyebrow } from "@/components/site/Eyebrow";
import { KitchenApply } from "@/components/partners/KitchenApply";
import { KitchenSetup } from "@/components/partners/KitchenSetup";
import { SignInToOtherSide } from "@/components/partners/SignInToOtherSide";
import { getKitchenPhotoUpdateRequest, listVerificationPhotos } from "@/lib/kitchen/data";
import { getKitchenApplication, getPartner, listBanks } from "@/lib/partners/data";
import { listAreaNames, listAreas } from "@/lib/shop/areas";

export const metadata: Metadata = {
  title: "Cook with Karrigo",
  description: "Put your kitchen in front of Makurdi. Take orders and let a Karrigo rider handle the delivery.",
};

/** One address for kitchen sign-up, adding a kitchen to an existing partner
 * business, and finishing that kitchen's setup. The kitchen and the store are
 * separate sign-ins: being signed in to the store does not open the kitchen.
 * An owner adds the kitchen to their session on purpose, here. */
export default async function KitchenPartnerPage() {
  const [kitchenSession, storeSession, areas, areaNames] = await Promise.all([
    getPartner("kitchen"),
    getPartner("store"),
    listAreas(),
    listAreaNames(),
  ]);
  const kitchen = kitchenSession?.kitchenId ? await getKitchenApplication() : null;

  // Signed URLs expire, so the photos are read on every load.
  const photos = kitchen?.isOwner ? await listVerificationPhotos() : { photos: [], failed: false };
  const updateRequest = kitchen?.isOwner ? await getKitchenPhotoUpdateRequest() : null;

  // The owner is signed in to the store only: they either register the
  // business's kitchen now, or (it already exists) sign in to it.
  const fromStore = !kitchenSession && storeSession !== null;
  const registeringKitchen = (kitchenSession !== null && kitchenSession.kitchenId === null) || (fromStore && storeSession.kitchenId === null);
  const owner = (kitchenSession ?? storeSession)?.isOwner ?? false;

  return (
    <div className="mx-auto max-w-[760px]">
      <Eyebrow className="rise">Cook with Karrigo</Eyebrow>
      <h1 className="text-section-small md:text-section rise rise-1 mt-md mb-xl text-balance">
        {registeringKitchen
          ? "Register your business as a kitchen"
          : fromStore
            ? "Your kitchen"
            : kitchen
              ? kitchen.name
              : "List your kitchen"}
      </h1>
      {kitchen ? (
        <KitchenSetup
          kitchen={kitchen}
          banks={await listBanks()}
          areas={areaNames}
          photos={photos.photos}
          photosFailed={photos.failed}
          updateRequest={updateRequest}
        />
      ) : registeringKitchen ? (
        <AddOtherSide side="kitchen" areas={areas} isOwner={owner} />
      ) : fromStore ? (
        <SignInToOtherSide side="kitchen" />
      ) : (
        <>
          <p className="text-site-body text-text-secondary mb-xl max-w-[52ch]">
            You&rsquo;ll tell us where you are, where to pay you, and what you cook — then
            our team approves your kitchen before it goes live.
          </p>
          <KitchenApply areas={areas} />
        </>
      )}
    </div>
  );
}
