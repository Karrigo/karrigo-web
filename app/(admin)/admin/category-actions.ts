"use server";

import { revalidatePath } from "next/cache";

import { api, type Schemas } from "@/lib/api/client";
import { requireSuperAdmin } from "@/lib/admin/session";

import type { ActionResult } from "./queue-actions";

type Category = Schemas["AdminCategoryResponseDto"];
type CategoryType = Category["type"];

const NAME_ERROR = "Give the category a name of 2 to 40 characters.";

/** Runs one change. Only a super admin may write; the backend enforces it too,
 *  so a refusal there (403) surfaces as its own message. */
async function attempt(work: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const message = await work();
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That didn't go through. Try again." };
  }
}

function checkedName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) throw new Error(NAME_ERROR);
  return trimmed;
}

function patch(id: string, body: { name?: string; sortOrder?: number; isActive?: boolean }) {
  return api<Category>(`/admin/categories/${encodeURIComponent(id)}`, { method: "PATCH", scope: "admin", body });
}

export async function createCategory(input: { name: string; type: CategoryType }): Promise<ActionResult> {
  return attempt(async () => {
    const name = checkedName(input.name);
    const category = await api<Category>("/admin/categories", {
      method: "POST",
      scope: "admin",
      body: { name, type: input.type },
    });
    return `${category.name} added`;
  });
}

export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  return attempt(async () => {
    await patch(id, { name: checkedName(name) });
    return "Category renamed";
  });
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  return attempt(async () => {
    await patch(id, { isActive });
    return isActive ? "Category is back on the list" : "Category deactivated · customers and kitchens no longer see it";
  });
}

/** Moves a category one place up or down. Sort orders start out equal (all 0),
 *  so swapping two numbers would do nothing; instead the whole type is read
 *  fresh, reordered, and every row whose number differs from its place is
 *  renumbered 0, 1, 2… */
export async function moveCategory(id: string, type: CategoryType, direction: "up" | "down"): Promise<ActionResult> {
  return attempt(async () => {
    const rows = await api<Category[]>("/admin/categories", { scope: "admin", query: { type } });
    const ordered = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const from = ordered.findIndex((c) => c.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0) throw new Error("That category no longer exists.");
    if (to < 0 || to >= ordered.length) return "Already there";
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    for (const [index, category] of ordered.entries()) {
      if (category.sortOrder !== index) await patch(category.id, { sortOrder: index });
    }
    return "Order updated";
  });
}
