import { describe, expect, test } from "bun:test";

import { freshOrders, orderKey } from "./new-orders";

const kitchen = { side: "kitchen" as const, id: "k1" };
const store = { side: "store" as const, id: "s1" };

describe("freshOrders", () => {
  test("the first look announces nothing", () => {
    expect(freshOrders(null, [kitchen, store], "/")).toEqual([]);
  });

  test("announces only orders that were not there before", () => {
    const before = new Set([orderKey(kitchen)]);
    expect(freshOrders(before, [kitchen, store], "/my-kitchen")).toEqual([store]);
  });

  test("a kitchen owner hears about a store order, and the reverse", () => {
    expect(freshOrders(new Set(), [store], "/my-kitchen")).toEqual([store]);
    expect(freshOrders(new Set(), [kitchen], "/my-store")).toEqual([kitchen]);
  });

  test("stays quiet on the orders page of the side that got the order", () => {
    expect(freshOrders(new Set(), [kitchen], "/my-kitchen/orders")).toEqual([]);
    expect(freshOrders(new Set(), [store], "/my-store/orders")).toEqual([]);
  });

  test("still tells a kitchen's orders page about a store order", () => {
    expect(freshOrders(new Set(), [store], "/my-kitchen/orders")).toEqual([store]);
  });
});
