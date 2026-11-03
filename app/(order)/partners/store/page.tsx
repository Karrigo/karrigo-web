import type { Metadata } from "next";

import { AddOtherSide } from "@/components/partners/AddOtherSide";
import { SignInToOtherSide } from "@/components/partners/SignInToOtherSide";
import { StoreApply } from "@/components/partners/StoreApply";
import { StoreSetup } from "@/components/partners/StoreSetup";
import { Eyebrow } from "@/components/site/Eyebrow";
import { getPartner, getStoreApplication, listBanks } from "@/lib/partners/data";
import { getStorePhotoUpdateRequest, listStoreVerificationPhotos } from "@/lib/partners/store-data";
import { listAreaNames, listAreas } from "@/lib/shop/areas";

export const metadata: Metadata = { title: "Sell on Karrigo" };

/** Store sign-up, adding a store to an existing partner business, and the
 * store's setup status all live at this route. The store and the kitchen are
 * separate sign-ins: being signed in to the kitchen does not open the store.
 * An owner adds the store to their session on purpose, here. */
export default async function StorePartnerPage() {
  const [storeSession, kitchenSession, areas] = await Promise.all([
    getPartner("store"),
    getPartner("kitchen"),
    listAreas(),
  ]);
  const store = storeSession?.storeId ? await getStoreApplication() : null;
  const setup = store
    ? await Promise.all([
        listBanks(),
        listAreaNames(),
        store.isOwner ? listStoreVerificationPhotos() : Promise.resolve({ photos: [], failed: false }),
        store.isOwner ? getStorePhotoUpdateRequest() : Promise.resolve(null),
      ])
    : null;
  const storeUnavailable = storeSession?.storeId != null && store === null;

  // The owner is signed in to the kitchen only: they either register the
  // business's store now, or (it already exists) sign in to it.
  const fromKitchen = !storeSession && kitchenSession !== null;
  const registeringStore =
    (storeSession !== null && storeSession.storeId === null) || (fromKitchen && kitchenSession.storeId === null);
  const owner = (storeSession ?? kitchenSession)?.isOwner ?? false;

  return (
    <div className="mx-auto max-w-[760px]">
      <Eyebrow className="rise">Sell with Karrigo</Eyebrow>
      <h1 className="text-section-small md:text-section rise rise-1 mt-md mb-xl text-balance">
        {registeringStore
          ? "Register your business as a store"
          : fromKitchen
            ? "Your store"
            : store
              ? store.name
              : storeUnavailable
                ? "Your store"
                : "Register your store"}
      </h1>
      {store ? (
        <StoreSetup
          store={store}
          banks={setup?.[0] ?? []}
          areas={setup?.[1] ?? []}
          photos={setup?.[2].photos ?? []}
          photosFailed={setup?.[2].failed ?? false}
          updateRequest={setup?.[3] ?? null}
        />
      ) : storeUnavailable ? (
        <div className="bg-bg rounded-panel-sm p-xl md:p-xxl">
          <p className="text-site-body text-text-secondary">
            Only the business owner can manage the store&rsquo;s setup. Ask them to log in here.
          </p>
        </div>
      ) : registeringStore ? (
        <AddOtherSide side="store" areas={areas} isOwner={owner} />
      ) : fromKitchen ? (
        <SignInToOtherSide side="store" />
      ) : (
        <>
          <p className="text-site-body text-text-secondary mb-xl max-w-[52ch]">
            Tell us about your store and where it is. Then you can add its location, payout account and verification
            photos before our team reviews it.
          </p>
          <StoreApply areas={areas} />
        </>
      )}
    </div>
  );
}
