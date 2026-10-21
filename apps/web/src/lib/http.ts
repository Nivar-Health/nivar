// The Nivar API's address, its errors and the JSON request itself, with no sign-in session.
// Public pages import this file; lib/api.ts adds the session (and with it the Supabase client).

/**
 * Where the API lives. The route handlers are part of this Next.js app, so:
 * - In the browser: `NEXT_PUBLIC_API_URL` when set, otherwise the same origin.
 * - On the server (SSR, server components): the `API_URL` binding if the host injects
 *   one, then `NEXT_PUBLIC_API_URL`, then this app's own local port in development.
 */
function resolveApiOrigin(): string {
  const isServer = typeof window === "undefined";
  const configured = (isServer && process.env.API_URL) || process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (isServer && process.env.NODE_ENV !== "production") return `http://localhost:${process.env.PORT ?? "3100"}`;
  return "";
}

/** API origin without a trailing slash; empty string means "same origin". */
export const API_ORIGIN = resolveApiOrigin();
export const API_BASE = `${API_ORIGIN}/api`;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** Human readable message for anything thrown by `api.*` (or elsewhere). */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/** Sends one JSON request to the API and returns the parsed body; anything but a 2xx throws ApiError. */
export async function requestJson<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: HttpOptions = {},
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach Nivar right now. Check your connection and try again.");
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const errObj =
      data && typeof data === "object" && "error" in data
        ? (data as { error?: { message?: string; code?: string } }).error
        : undefined;
    const message =
      errObj?.message ||
      (res.status === 401
        ? "Your session has expired. Please sign in again."
        : res.status === 403
          ? "You don't have access to this."
          : res.status === 404
            ? "Not found."
            : `Request failed (${res.status}).`);
    throw new ApiError(res.status, message, errObj?.code, data);
  }

  return data as T;
}

/** Anonymous requests, for public pages that must not load the sign-in session (the landing's callback form). */
export const publicApi = {
  post: <T>(path: string, body?: unknown, options?: HttpOptions) => requestJson<T>("POST", path, body ?? {}, options),
};
