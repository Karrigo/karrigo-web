import { describe, expect, test } from "bun:test";

import { isVerified, verifiedLabel } from "./verified";

describe("isVerified", () => {
  test("only a literal true counts", () => {
    expect(isVerified(true)).toBe(true);
    for (const v of [undefined, null, false, "true", 1, {}]) expect(isVerified(v)).toBe(false);
  });
});

describe("verifiedLabel", () => {
  test("names the vendor kind", () => {
    expect(verifiedLabel("kitchen")).toBe("Verified kitchen");
    expect(verifiedLabel("store")).toBe("Verified store");
  });
});
