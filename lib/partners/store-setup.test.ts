import { describe, expect, test } from "bun:test";

import type { StoreApplication } from "./types";
import { storeSetupProgress } from "./store-setup";

const store = (overrides: Partial<StoreApplication> = {}): StoreApplication => ({
  name: "Mama Ngozi Groceries",
  status: "PENDING",
  note: null,
  appealNote: null,
  appealedAt: null,
  appealResponse: null,
  neverApproved: false,
  area: null,
  landmarkNote: null,
  hasLocation: false,
  bankAccountName: null,
  bankAccountLast4: null,
  imageUrl: null,
  hasOwnerPhoto: false,
  requiresCac: false,
  hasCacDocument: false,
  isOwner: true,
  riderBaseFeeKobo: null,
  verificationPhotoCount: 0,
  missing: ["LOCATION", "RIDER_FEE"],
  ...overrides,
});

describe("storeSetupProgress", () => {
  test("lists every store setup gap, owner photo and storefront image included", () => {
    expect(storeSetupProgress(store(), 2)).toEqual({
      left: 6,
      photosDone: false,
      items: [
        { label: "Set your store's location", href: "#location" },
        { label: "Set the rider base delivery fee", href: "#rider-fee" },
        { label: "Add the business payout account", href: "#payout" },
        { label: "Store photos: 2 of 6", href: "#photos" },
        { label: "Add the owner's photo", href: "#owner-photo" },
        { label: "Add a storefront image", href: "#storefront" },
      ],
    });
  });

  test("asks for the CAC certificate only when ops requires it", () => {
    const done = {
      hasLocation: true,
      bankAccountName: "NGOZI OKAFOR",
      bankAccountLast4: "1234",
      riderBaseFeeKobo: 150_000,
      missing: [],
      hasOwnerPhoto: true,
      imageUrl: "https://img/store.jpg",
    } satisfies Partial<StoreApplication>;
    expect(storeSetupProgress(store(done), 6).items).toEqual([]);
    expect(storeSetupProgress(store({ ...done, requiresCac: true }), 6).items).toEqual([
      { label: "Upload the CAC certificate", href: "#cac" },
    ]);
    expect(storeSetupProgress(store({ ...done, requiresCac: true, hasCacDocument: true }), 6).items).toEqual([]);
  });

  test("treats an existing business payout account as complete", () => {
    expect(
      storeSetupProgress(
        store({
          hasLocation: true,
          bankAccountName: "NGOZI OKAFOR",
          bankAccountLast4: "1234",
          riderBaseFeeKobo: 150_000,
          missing: [],
          hasOwnerPhoto: true,
          imageUrl: "https://img/store.jpg",
        }),
        6,
      ),
    ).toEqual({ left: 0, photosDone: true, items: [] });
  });

  test("uses the store photo count supplied by the store photo list", () => {
    const result = storeSetupProgress(store({ verificationPhotoCount: 6 }), 1);

    expect(result.photosDone).toBe(false);
    expect(result.items.find((item) => item.href === "#photos")?.label).toBe("Store photos: 1 of 6");
  });
});
