import { describe, expect, test } from "bun:test";

import { approvalBlockedMessage } from "./approval";

describe("approvalBlockedMessage", () => {
  test("names every missing item", () => {
    expect(
      approvalBlockedMessage("kitchen", { code: "ONBOARDING_INCOMPLETE", details: ["LOCATION", "PAYOUT_ACCOUNT", "CAC_DOCUMENT"] }),
    ).toBe("Can't approve yet. This kitchen still needs a pinned location, a confirmed payout bank account and the CAC certificate.");
  });

  test("reads naturally for one item", () => {
    expect(approvalBlockedMessage("store", { code: "ONBOARDING_INCOMPLETE", details: ["RIDER_FEE"] })).toBe(
      "Can't approve yet. This store still needs a rider fee.",
    );
  });

  test("ignores unknown items and falls back to a plain sentence", () => {
    expect(approvalBlockedMessage("store", { code: "ONBOARDING_INCOMPLETE", details: ["SOMETHING_NEW"] })).toContain("hasn't finished setting up");
    expect(approvalBlockedMessage("store", { code: "ONBOARDING_INCOMPLETE" })).toContain("hasn't finished setting up");
  });

  test("is null for any other error", () => {
    expect(approvalBlockedMessage("kitchen", { code: "VERIFICATION_PHOTOS_REQUIRED" })).toBeNull();
    expect(approvalBlockedMessage("kitchen", {})).toBeNull();
  });
});
