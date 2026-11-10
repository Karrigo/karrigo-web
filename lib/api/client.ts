import "server-only";

import { cookies } from "next/headers";

import { API_URL, SCOPES, type Scope } from "./scopes";
import type { Schemas } from "./types";

export type { Schemas };

/** A non-2xx answer from karrigo-be. `message` is the backend's own words and
 *  is written for a person (CLAUDE.md: errors are user-readable). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The whole error body — some carry flags like `accountExists`. */
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  get unauthorized() {
    return this.status === 401;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Which signed-in identity to send. Omit for a public endpoint. */
  scope?: Scope;
  /** Pass for a public GET that may be cached briefly. Anything signed-in is
   *  never cached; prices shown to a user are always live (CLAUDE.md rule 5). */
  revalidate?: number;
};

/** Gateway answers that mean "not right now", worth one more try for a read. */
const RETRYABLE = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 400;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function messageOf(body: unknown, status: number): string {
  const raw =
    body && typeof body === "object" && "message" in body
      ? (body as { message: unknown }).message
      : undefined;
  if (Array.isArray(raw)) return String(raw[0]);
  if (typeof raw === "string" && raw) return raw;
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return "That didn't work. Check what you entered and try again.";
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", query, body, scope, revalidate } = options;

  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  // A file upload is multipart: leave Content-Type to fetch, which adds the
  // boundary. Everything else is JSON.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (scope) {
    const token = (await cookies()).get(SCOPES[scope].access)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init = {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    ...(scope || revalidate === undefined ? { cache: "no-store" as const } : { next: { revalidate } }),
  };

  // A read can be asked again without harm, so a dropped connection or
  // gateway hiccup (a tunnel, a deploy restarting) is absorbed instead of
  // breaking the page. Writes are never repeated: they might have landed.
  const attempts = method === "GET" ? 3 : 1;
  let response: Response | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      response = await fetch(url, init);
      if (attempt < attempts && RETRYABLE.has(response.status)) {
        await pause(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    } catch {
      if (attempt < attempts) {
        await pause(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new ApiError(
        0,
        "We couldn't reach Karrigo's servers. Check your connection and try again.",
      );
    }
  }
  if (!response) {
    throw new ApiError(0, "We couldn't reach Karrigo's servers. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    // Not JSON (a proxy error page, say) — fall through to the status text.
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageOf(parsed, response.status),
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {},
    );
  }
  return parsed as T;
}
