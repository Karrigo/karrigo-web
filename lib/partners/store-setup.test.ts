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
  isOwner: true,
  riderBaseFeeKobo: null,
  verificationPhotoCount: 0,
  missing: ["LOCATION", "RIDER_FEE"],
  ...overrides,
});

describe("storeSetupProgress", () => {
  test("lists all four store-specific setup gaps", () => {
    expect(storeSetupProgress(store(), 2)).toEqual({
      left: 4,
      photosDone: false,
      items: [
        { label: "Set your store's location", href: "#location" },
        { label: "Set the rider base delivery fee", href: "#rider-fee" },
        { label: "Add the business payout account", href: "#payout" },
        { label: "Store photos: 2 of 6", href: "#photos" },
      ],
    });
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
        }),
        6,
      ),
    ).toEqual({ left: 0, photosDone: true, items: [] });
  });

  test("uses the store photo count supplied by the store photo list", () => {
    const result = storeSetupProgress(store({ verificationPhotoCount: 6 }), 1);

    expect(result.photosDone).toBe(false);
    expect(result.items.at(-1)?.label).toBe("Store photos: 1 of 6");
  });
});
