import { describe, expect, test } from "bun:test";

import { photoLockState } from "./photo-lock";

const pending = (extra = {}) => ({
  id: "r1",
  status: "PENDING" as const,
  reason: "Repainted the shopfront sign",
  unlockedUntil: null,
  createdAt: "2026-10-31T00:00:00.000Z",
  updatedAt: "2026-10-31T00:00:00.000Z",
  ...extra,
});

describe("photoLockState", () => {
  test("photos stay editable until the business is approved", () => {
    for (const status of ["PENDING", "SUSPENDED", undefined]) {
      expect(photoLockState(status, null)).toBe("editable");
      expect(photoLockState(status, pending())).toBe("editable");
    }
  });

  test("an approved business with no request is locked", () => {
    expect(photoLockState("ACTIVE", null)).toBe("locked");
  });

  test("a pending request reads as pending, a rejected one locks again", () => {
    expect(photoLockState("ACTIVE", pending())).toBe("pending");
    expect(photoLockState("ACTIVE", pending({ status: "REJECTED" }))).toBe("locked");
  });

  test("an approved request unlocks until its window lapses", () => {
    const open = pending({
      status: "APPROVED",
      unlockedUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(photoLockState("ACTIVE", open)).toBe("unlocked");
    const lapsed = pending({
      status: "APPROVED",
      unlockedUntil: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(photoLockState("ACTIVE", lapsed)).toBe("locked");
  });
});
