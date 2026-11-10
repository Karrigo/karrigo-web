import { beforeEach, describe, expect, mock, test } from "bun:test";

const revalidated: string[] = [];
const calls: { path: string; options: { method?: string; body?: unknown } }[] = [];
let role = "SUPER_ADMIN";
let fail: Error | null = null;

mock.module("next/cache", () => ({ revalidatePath: (path: string) => revalidated.push(path) }));
mock.module("@/lib/admin/session", () => ({
  requireAdmin: async () => ({ role }),
  requireSuperAdmin: async () => {
    if (role !== "SUPER_ADMIN") throw new Error("Only a super admin can do that.");
    return { role };
  },
}));
mock.module("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {},
  api: async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, options });
    if (fail) throw fail;
    return {};
  },
}));

const { setVerified } = await import("../../app/(admin)/admin/moderation-actions");

beforeEach(() => {
  revalidated.length = 0;
  calls.length = 0;
  role = "SUPER_ADMIN";
  fail = null;
});

describe("setVerified", () => {
  test("PATCHes the kitchen and revalidates", async () => {
    const result = await setVerified("kitchens", "k 1", true);
    expect(result).toEqual({ ok: true, message: "Kitchen verified" });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/admin/kitchens/k%201/verified");
    expect(calls[0].options).toMatchObject({ method: "PATCH", body: { verified: true } });
    expect(revalidated).toEqual(["/admin"]);
  });

  test("removes verification from a store", async () => {
    const result = await setVerified("stores", "s1", false);
    expect(result).toEqual({ ok: true, message: "Store verification removed" });
    expect(calls[0].path).toBe("/admin/stores/s1/verified");
    expect(calls[0].options.body).toEqual({ verified: false });
  });

  test("a moderator is refused before any request is made", async () => {
    role = "MODERATOR";
    const result = await setVerified("kitchens", "k1", true);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(revalidated).toHaveLength(0);
  });

  test("a backend failure is returned, not thrown, and nothing is revalidated", async () => {
    fail = new Error("Kitchen not found.");
    const result = await setVerified("kitchens", "k1", true);
    expect(result).toEqual({ ok: false, error: "Kitchen not found." });
    expect(revalidated).toHaveLength(0);
  });
});
