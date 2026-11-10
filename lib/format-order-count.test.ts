import { describe, expect, test } from "bun:test";

import { formatOrderCount } from "./format-order-count";

describe("formatOrderCount", () => {
  test("under 10 shows nothing", () => {
    for (const n of [0, 1, 9]) expect(formatOrderCount(n)).toBeNull();
  });

  test("10 to 99 is exact", () => {
    expect(formatOrderCount(10)).toBe("10 orders");
    expect(formatOrderCount(99)).toBe("99 orders");
  });

  test("100 to 999 rounds down to 10s with a plus", () => {
    expect(formatOrderCount(100)).toBe("100+ orders");
    expect(formatOrderCount(109)).toBe("100+ orders");
    expect(formatOrderCount(129)).toBe("120+ orders");
    expect(formatOrderCount(999)).toBe("990+ orders");
  });

  test("1000 and up rounds down to 100s with a plus", () => {
    expect(formatOrderCount(1000)).toBe("1000+ orders");
    expect(formatOrderCount(1099)).toBe("1000+ orders");
    expect(formatOrderCount(1299)).toBe("1200+ orders");
  });

  test("non-integers round down first", () => {
    expect(formatOrderCount(9.9)).toBeNull();
    expect(formatOrderCount(10.7)).toBe("10 orders");
    expect(formatOrderCount(99.9)).toBe("99 orders");
  });

  test("missing or bad values never render", () => {
    for (const v of [NaN, Infinity, -Infinity, -5, undefined, null, "42", {}]) {
      expect(formatOrderCount(v as number)).toBeNull();
    }
  });
});
