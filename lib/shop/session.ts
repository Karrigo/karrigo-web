import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { ApiError, api, type Schemas } from "@/lib/api/client";
import { SCOPES } from "@/lib/api/scopes";
import { nairaToKobo } from "@/lib/money";
import type { Customer } from "./types";

/**
 * The signed-in customer, or null. One lookup per request, and none at all
 * without a customer session: the layout asks on every page, and most visits
 * are signed out or are kitchen staff, who have nobody to look up. (Asking
 * anyway is a guaranteed 401 each time.)
 */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  if (!(await cookies()).get(SCOPES.customer.access)?.value) return null;

  try {
    const me = await api<Schemas["UserResponseDto"]>("/auth/me", { scope: "customer" });
    // Riders are partner-app only. A rider session left over from before this
    // rule (or any other way in) counts as signed out on the website.
    if ((me as { role?: string }).role === "RIDER") return null;
    return {
      id: me.id,
      name: me.name ?? "",
      phone: me.phone,
      email: me.email ?? null,
      creditKobo: nairaToKobo(me.creditBalanceNaira),
    };
  } catch (error) {
    if (error instanceof ApiError && (error.unauthorized || error.status === 403)) return null;
    throw error;
  }
});
