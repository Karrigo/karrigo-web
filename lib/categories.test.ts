import { describe, expect, test } from "bun:test";

import {
  hasValidCategories,
  initialCategoryIds,
  MAX_CATEGORIES,
  partitionKnownIds,
  toggleCategory,
} from "./categories";

describe("toggleCategory", () => {
  test("adds and removes", () => {
    expect(toggleCategory([], "a")).toEqual(["a"]);
    expect(toggleCategory(["a", "b"], "a")).toEqual(["b"]);
  });
  test("ignores a sixth pick", () => {
    const five = ["a", "b", "c", "d", "e"];
    expect(five.length).toBe(MAX_CATEGORIES);
    expect(toggleCategory(five, "f")).toEqual(five);
    expect(toggleCategory(five, "e")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("hasValidCategories", () => {
  test("needs 1 to 5", () => {
    expect(hasValidCategories([])).toBe(false);
    expect(hasValidCategories(["a"])).toBe(true);
    expect(hasValidCategories(["a", "b", "c", "d", "e", "f"])).toBe(false);
  });
});

describe("initialCategoryIds / partitionKnownIds", () => {
  test("tolerates a missing field", () => {
    expect(initialCategoryIds(undefined)).toEqual([]);
    expect(initialCategoryIds([{ id: "a" }, { id: "b" }])).toEqual(["a", "b"]);
  });
  test("reports a deactivated category as dropped", () => {
    expect(partitionKnownIds(["a", "gone"], [{ id: "a" }])).toEqual({
      ids: ["a"],
      dropped: true,
    });
    expect(partitionKnownIds(["a"], [{ id: "a" }])).toEqual({
      ids: ["a"],
      dropped: false,
    });
  });
});
