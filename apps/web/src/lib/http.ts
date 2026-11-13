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

/** Shown for any failure that did not come with Nivar's own wording. */
export const GENERIC_ERROR = "Something went wrong. Try again.";
export const TIMEOUT_ERROR = "That took too long. Check your connection and try again.";
export const OFFLINE_ERROR = "Can't reach Nivar right now. Check your connection and try again.";

/**
 * Human readable message for anything thrown by `api.*` (or elsewhere). Only an ApiError carries
 * wording meant for people; any other error (a browser or library message) gives the fallback.
 */
export function errorMessage(err: unknown, fallback = GENERIC_ERROR): string {
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

/**
 * The sentence for a failed response. The API's own message passes through only when the API wrote
 * it (its errors always carry a code); a proxy, a rate limiter or a provider never reaches the screen.
 */
function failureMessage(status: number, errObj: { message?: string; code?: string } | undefined): string {
  if (errObj?.code && errObj.message) return errObj.message;
  if (status === 401) return "Your session has ended. Sign in again.";
  if (status === 403) return "You don't have access to this.";
  if (status === 404) return "We couldn't find that.";
  if (status === 429) return "Too many tries. Wait a minute, then try again.";
  return GENERIC_ERROR;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Give up after this many milliseconds (default 15 s; 0 waits for ever). */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Sends one JSON request to the API and returns the parsed body; anything but a 2xx throws ApiError.
 * A request that takes longer than the timeout (body included) throws ApiError(0, TIMEOUT_ERROR,
 * "timeout"); the caller's own abort still throws the browser's AbortError, as before.
 */
export async function requestJson<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: HttpOptions = {},
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  // One controller for both the caller's signal and the timeout. A plain timer rather than
  // AbortSignal.timeout / AbortSignal.any, which older iPhones do not have.
  const controller = new AbortController();
  const callerSignal = options.signal;
  const forward = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) forward();
  else callerSignal?.addEventListener("abort", forward, { once: true });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;

  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    text = await res.text();
  } catch (err) {
    if (timedOut) throw new ApiError(0, TIMEOUT_ERROR, "timeout");
    if (callerSignal?.aborted) throw err;
    throw new ApiError(0, OFFLINE_ERROR);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forward);
  }

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
    throw new ApiError(res.status, failureMessage(res.status, errObj), errObj?.code, data);
  }

  return data as T;
}

/** Anonymous requests, for public pages that must not load the sign-in session (the landing's callback form). */
export const publicApi = {
  post: <T>(path: string, body?: unknown, options?: HttpOptions) => requestJson<T>("POST", path, body ?? {}, options),
};
