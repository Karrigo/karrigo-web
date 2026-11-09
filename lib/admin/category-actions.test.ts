import { beforeEach, describe, expect, mock, test } from "bun:test";

const revalidated: string[] = [];
const patched: string[] = [];
let failOn = Infinity;

const rows = ["a", "b", "c"].map((name) => ({
  id: name,
  name,
  slug: name,
  type: "FOOD",
  sortOrder: 0,
  isActive: true,
}));

mock.module("next/cache", () => ({ revalidatePath: (path: string) => revalidated.push(path) }));
mock.module("@/lib/admin/session", () => ({
  // Bun module mocks are process-wide and fix their export names on first use.
  requireAdmin: async () => ({ role: "SUPER_ADMIN" }),
  requireSuperAdmin: async () => ({ role: "SUPER_ADMIN" }),
}));
mock.module("@/lib/api/client", () => ({
  // Bun module mocks are process-wide: other action files import ApiError from here.
  ApiError: class ApiError extends Error {},
  api: async (path: string, options: { method?: string } = {}) => {
    if (options.method === "PATCH") {
      patched.push(path);
      if (patched.length >= failOn) throw new Error("boom");
      return {};
    }
    return rows;
  },
}));

const { moveCategory } = await import("../../app/(admin)/admin/category-actions");

beforeEach(() => {
  revalidated.length = 0;
  patched.length = 0;
  failOn = Infinity;
});

describe("moveCategory", () => {
  test("revalidates and reports success", async () => {
    const result = await moveCategory("c", "FOOD", "up");
    expect(result.ok).toBe(true);
    expect(revalidated).toEqual(["/admin"]);
  });

  test("a PATCH failing partway still revalidates and warns the order may have changed", async () => {
    failOn = 2;
    const result = await moveCategory("c", "FOOD", "up");
    expect(patched.length).toBe(2);
    expect(revalidated).toEqual(["/admin"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("partly changed");
  });
});
