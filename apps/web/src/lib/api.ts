// Typed fetch wrapper for the Nivar API, plus the per-tab session token store.

import { getSupabase, peekStoredSession } from "@/lib/supabase";

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
// Token store (spec section 3)
//
// Backed by the Supabase session, which lives in sessionStorage so every tab can
// hold a different role during the demo and is mirrored to localStorage so a new
// tab inherits the most recent login (see lib/supabase.ts). `get()` returns the
// cached access token synchronously; `subscribe` follows Supabase auth events.
// ---------------------------------------------------------------------------

type Listener = () => void;

let cachedToken: string | null = null;
let tokenLoaded = false;
let authListening = false;
const tokenListeners = new Set<Listener>();

function setCachedToken(next: string | null) {
  tokenLoaded = true;
  if (cachedToken === next) return;
  cachedToken = next;
  tokenListeners.forEach((l) => l());
}

function listenToAuth() {
  if (authListening || typeof window === "undefined") return;
  authListening = true;
  getSupabase().auth.onAuthStateChange((_event, session) => {
    setCachedToken(session?.access_token ?? null);
  });
}

export const tokenStore = {
  /** The current access token (may be close to expiry; requests fetch a fresh one). */
  get(): string | null {
    if (typeof window === "undefined") return null;
    if (!tokenLoaded) {
      cachedToken = peekStoredSession()?.accessToken ?? null;
      tokenLoaded = true;
    }
    return cachedToken;
  },
  /** Signs this tab out locally. Other tabs keep their own sessions. */
  clear() {
    const had = tokenStore.get() !== null;
    setCachedToken(null);
    if (!had) return;
    void getSupabase()
      .auth.signOut({ scope: "local" })
      .catch(() => {});
  },
  subscribe(listener: Listener): () => void {
    tokenListeners.add(listener);
    listenToAuth();
    return () => {
      tokenListeners.delete(listener);
    };
  },
};

/** Access token for a request, letting Supabase refresh it when it is about to expire. */
async function currentAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (tokenStore.get() === null) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) setCachedToken(token);
    return token ?? tokenStore.get();
  } catch {
    return tokenStore.get();
  }
}

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

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  signal?: AbortSignal;
  /** Skip attaching the bearer token. */
  anonymous?: boolean;
  headers?: Record<string, string>;
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const token = options.anonymous ? null : await currentAccessToken();
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

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
    // An authenticated call that comes back 401 means our session is no longer valid.
    if (res.status === 401 && token && tokenStore.get() !== null) {
      tokenStore.clear();
    }
    throw new ApiError(res.status, message, errObj?.code, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body ?? {}, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body ?? {}, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body ?? {}, options),
  del: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("DELETE", path, body, options),
};

/** Builds a query string from defined, non-empty values: qs({ a: 1, b: "" }) -> "?a=1". */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
