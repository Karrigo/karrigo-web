"use server";

import { revalidatePath } from "next/cache";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { requireAdmin } from "@/lib/admin/session";
import { nairaToKobo } from "@/lib/money";

import type { ActionResult } from "./queue-actions";

function fail(error: unknown): ActionResult {
  if (error instanceof ApiError || error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "That didn't go through. Try again." };
}

async function attempt(work: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const message = await work();
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------- flagged products */

export type KitchenProduct = { id: string; name: string; section: string; priceKobo: number; unit: string };

/** The products customers can currently see in a kitchen — the ones that can
 *  still be flagged. Ops has no menu endpoint of its own, so this reads the
 *  public menu (an already-flagged product is hidden there, and is on the
 *  Flagged page instead). */
export async function kitchenProducts(
  kitchenId: string,
): Promise<{ ok: true; products: KitchenProduct[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const kitchen = await api<Schemas["AdminKitchenDetailDto"]>(`/admin/kitchens/${encodeURIComponent(kitchenId)}`, {
      scope: "admin",
    });
    const menu = await api<Schemas["KitchenWithMenuResponseDto"]>(`/kitchens/${encodeURIComponent(kitchen.slug)}`);
    return {
      ok: true,
      products: menu.sections.flatMap((s) =>
        s.items.map((i) => ({
          id: i.id,
          name: i.name,
          section: s.label,
          priceKobo: nairaToKobo(i.priceNaira),
          unit: i.unit ?? "",
        })),
      ),
    };
  } catch (error) {
    const result = fail(error);
    return { ok: false, error: result.ok ? "" : result.error };
  }
}

export async function flagProduct(id: string, note: string): Promise<ActionResult> {
  return attempt(async () => {
    if (!note.trim()) throw new Error("Add a note — the kitchen's owner sees it.");
    await api(`/admin/menu-items/${encodeURIComponent(id)}/flag`, {
      method: "POST",
      scope: "admin",
      body: { note: note.trim() },
    });
    return "Product flagged · hidden from customers";
  });
}

export async function clearProductFlag(id: string): Promise<ActionResult> {
  return attempt(async () => {
    await api(`/admin/menu-items/${encodeURIComponent(id)}/flag`, { method: "DELETE", scope: "admin" });
    return "Flag cleared · product is back on sale";
  });
}

/** Answers an appeal against a flag without clearing it. The owner sees the answer and may appeal again. */
export async function declineProductAppeal(id: string, response: string): Promise<ActionResult> {
  return attempt(async () => {
    if (!response.trim()) throw new Error("Write an answer — the owner reads it.");
    await api(`/admin/menu-items/${encodeURIComponent(id)}/appeal/decline`, {
      method: "POST",
      scope: "admin",
      body: { response: response.trim() },
    });
    return "Answer sent · the owner can appeal again";
  });
}

/* ------------------------------------------------------- store products */

export async function clearStoreProductFlag(id: string): Promise<ActionResult> {
  return attempt(async () => {
    await api(`/admin/store-products/${encodeURIComponent(id)}/flag`, { method: "DELETE", scope: "admin" });
    return "Flag cleared · product is back on sale";
  });
}

export async function declineStoreProductAppeal(id: string, response: string): Promise<ActionResult> {
  return attempt(async () => {
    if (!response.trim()) throw new Error("Write an answer — the owner reads it.");
    await api(`/admin/store-products/${encodeURIComponent(id)}/appeal/decline`, {
      method: "POST",
      scope: "admin",
      body: { response: response.trim() },
    });
    return "Answer sent · the owner can appeal again";
  });
}

/* ----------------------------------------------------------------- areas */

export async function createArea(input: { name: string }): Promise<ActionResult> {
  return attempt(async () => {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Give the area a name of at least two letters.");
    const area = await api<Schemas["AdminAreaResponseDto"]>("/admin/areas", {
      method: "POST",
      scope: "admin",
      body: { name },
    });
    return `${area.name} added`;
  });
}

export async function renameArea(id: string, name: string): Promise<ActionResult> {
  return attempt(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new Error("Give the area a name of at least two letters.");
    await api(`/admin/areas/${encodeURIComponent(id)}`, { method: "PATCH", scope: "admin", body: { name: trimmed } });
    return "Area renamed";
  });
}

export async function setAreaActive(id: string, isActive: boolean): Promise<ActionResult> {
  return attempt(async () => {
    await api(`/admin/areas/${encodeURIComponent(id)}`, { method: "PATCH", scope: "admin", body: { isActive } });
    return isActive ? "Area is back on the list" : "Area archived · customers no longer see it";
  });
}
