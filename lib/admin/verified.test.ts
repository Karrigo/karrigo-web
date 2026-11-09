import { describe, expect, test } from "bun:test";

import { isVerified, parseVerifiedFilter, verifiedParam, verifiedQuery } from "./verified";

describe("parseVerifiedFilter", () => {
  test("reads true and false", () => {
    expect(parseVerifiedFilter("true")).toBe("verified");
    expect(parseVerifiedFilter("false")).toBe("unverified");
  });

  test("anything else falls back to All", () => {
    for (const raw of [undefined, "", "yes", "TRUE", "1", ["true", "false"]]) {
      expect(parseVerifiedFilter(raw)).toBe("all");
    }
  });
});

describe("verifiedQuery / verifiedParam", () => {
  test("All sends nothing", () => {
    expect(verifiedQuery("all")).toBeUndefined();
    expect(verifiedParam("all")).toBe("");
  });

  test("Verified and Not verified map to true and false", () => {
    expect(verifiedQuery("verified")).toBe(true);
    expect(verifiedQuery("unverified")).toBe(false);
    expect(verifiedParam("verified")).toBe("true");
    expect(verifiedParam("unverified")).toBe("false");
  });
});

describe("isVerified", () => {
  test("prefers the verified flag", () => {
    expect(isVerified({ verified: true })).toBe(true);
    expect(isVerified({ verified: false, verifiedAt: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  test("falls back to verifiedAt on list rows", () => {
    expect(isVerified({ verifiedAt: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(isVerified({ verifiedAt: null })).toBe(false);
    expect(isVerified({})).toBe(false);
  });
});
