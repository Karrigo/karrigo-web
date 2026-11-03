"use server";

import { cookies } from "next/headers";

import { API_URL, SCOPES } from "@/lib/api/scopes";

/**
 * What the browser needs to open the live-updates socket. The socket can only
 * authenticate with a token in its handshake, so this hands the short-lived
 * access token to the page; the refresh token never leaves its httpOnly
 * cookie. Called again on every reconnect, so a renewed token is picked up.
 */
export async function liveSocketAuth(scope: "customer" | "kitchen" | "store"): Promise<{ origin: string; token: string } | null> {
  const token = (await cookies()).get(SCOPES[scope].access)?.value;
  if (!token) return null;
  return { origin: new URL(API_URL).origin, token };
}
