import { describe, expect, test } from "bun:test";

import { categoryHref, categoryNames, resolveCategoryParam } from "./category-filter";

const known = [{ id: "c1" }, { id: "c2" }];

describe("resolveCategoryParam", () => {
  test("accepts an active id", () => expect(resolveCategoryParam("c2", known)).toBe("c2"));
  test("takes the first of a repeated param", () => expect(resolveCategoryParam(["c1", "zzz"], known)).toBe("c1"));
  test("unknown or deactivated id falls back to unfiltered", () => expect(resolveCategoryParam("gone", known)).toBeUndefined());
  test("missing or blank is unfiltered", () => {
    expect(resolveCategoryParam(undefined, known)).toBeUndefined();
    expect(resolveCategoryParam("  ", known)).toBeUndefined();
    expect(resolveCategoryParam([], known)).toBeUndefined();
  });
  test("unfiltered when the category list failed to load", () => expect(resolveCategoryParam("c1", null)).toBeUndefined());
});

describe("categoryHref", () => {
  test("All drops the param", () => expect(categoryHref("/stores", null)).toBe("/stores"));
  test("encodes the id", () => expect(categoryHref("/stores", "a b")).toBe("/stores?category=a%20b"));
});

describe("categoryNames", () => {
  test("maps names, tolerating a missing field", () => {
    expect(categoryNames([{ name: "Soups" }])).toEqual(["Soups"]);
    expect(categoryNames(undefined)).toEqual([]);
    expect(categoryNames(null)).toEqual([]);
  });
});
