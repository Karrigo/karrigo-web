import { describe, expect, test } from "bun:test";

import { planPhotoBatch } from "./photo-batch";

describe("planPhotoBatch", () => {
  test("takes everything when it all fits", () => {
    expect(planPhotoBatch(3, 2, 6)).toEqual({ take: 3, skipped: 0 });
  });

  test("caps the batch at the remaining slots", () => {
    expect(planPhotoBatch(5, 4, 6)).toEqual({ take: 2, skipped: 3 });
  });

  test("takes nothing when the set is already full", () => {
    expect(planPhotoBatch(2, 6, 6)).toEqual({ take: 0, skipped: 2 });
  });

  test("treats over-full existing counts as full", () => {
    expect(planPhotoBatch(1, 8, 6)).toEqual({ take: 0, skipped: 1 });
  });

  test("an empty pick takes nothing and skips nothing", () => {
    expect(planPhotoBatch(0, 2, 6)).toEqual({ take: 0, skipped: 0 });
  });
});
