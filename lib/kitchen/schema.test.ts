import { describe, expect, test } from "bun:test";

import { dishSchema } from "./schema";

const base = {
  sectionId: "s1",
  name: "Jollof rice",
  description: "",
  priceNaira: 2800,
  unit: "",
};

describe("dishSchema categoryIds", () => {
  test("is optional so old callers still pass", () => {
    expect(dishSchema.safeParse(base).success).toBe(true);
  });
  test("accepts 1 to 5 ids", () => {
    expect(dishSchema.safeParse({ ...base, categoryIds: ["a"] }).success).toBe(
      true,
    );
    expect(
      dishSchema.safeParse({ ...base, categoryIds: ["a", "b", "c", "d", "e"] })
        .success,
    ).toBe(true);
  });
  test("rejects 0 and 6 ids", () => {
    expect(dishSchema.safeParse({ ...base, categoryIds: [] }).success).toBe(
      false,
    );
    expect(
      dishSchema.safeParse({
        ...base,
        categoryIds: ["a", "b", "c", "d", "e", "f"],
      }).success,
    ).toBe(false);
  });
});
