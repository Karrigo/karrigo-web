import "server-only";

import { api, type Schemas } from "@/lib/api/client";
import type { Category } from "@/lib/categories";

/** Active categories (public, no auth), for one side when `type` is given, else both. Null when the list can't be loaded, so the form can offer a retry instead of failing the page. */
export async function getActiveCategories(type?: Category["type"]): Promise<Category[] | null> {
  try {
    const rows = await api<Schemas["CategoryResponseDto"][]>("/categories", { query: { type } });
    return rows.map((c) => ({ id: c.id, name: c.name, type: c.type }));
  } catch {
    return null;
  }
}
