// Typed fetch wrapper for the Nivar API, plus the per-tab session token store.

/**
 * Where the API lives.
 * - On the server (SSR, server components): the `API_URL` binding injected by the host
 *   (Vercel services), then `NEXT_PUBLIC_API_URL`.
 * - In the browser: `NEXT_PUBLIC_API_URL` when set, otherwise the same origin, where the
 *   host rewrites `/api/*` and `/socket.io/*` to the API service.
 * - Local development falls back to the API dev server on port 4100.
 */
function resolveApiOrigin(): string {
  const isServer = typeof window === "undefined";
  const configured = (isServer && process.env.API_URL) || process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:4100";
}

/** API origin without a trailing slash; empty string means "same origin". */
export const API_ORIGIN = resolveApiOrigin();
export const API_BASE = `${API_ORIGIN}/api`;

// ---------------------------------------------------------------------------
// Token store (spec section 3)
//
// The token lives in sessionStorage so every tab can hold a different role
// during the demo, and is mirrored to localStorage so a freshly opened tab
// inherits the most recent login. On first read a tab prefers its own
// sessionStorage and falls back to (and adopts) the localStorage copy.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "nivar_token";

type Listener = () => void;

let cachedToken: string | null = null;
let tokenLoaded = false;
const tokenListeners = new Set<Listener>();

function safeStorage(kind: "session" | "local"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function loadToken(): string | null {
  const session = safeStorage("session");
  const fromSession = session?.getItem(TOKEN_KEY);
  if (fromSession) return fromSession;
  const fromLocal = safeStorage("local")?.getItem(TOKEN_KEY) ?? null;
  // Adopt the shared token for this tab so later logins in other tabs don't change it.
  if (fromLocal) session?.setItem(TOKEN_KEY, fromLocal);
  return fromLocal;
}

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    if (!tokenLoaded) {
      cachedToken = loadToken();
      tokenLoaded = true;
    }
    return cachedToken;
  },
  set(token: string) {
    tokenLoaded = true;
    if (cachedToken === token) return;
    cachedToken = token;
    safeStorage("session")?.setItem(TOKEN_KEY, token);
    safeStorage("local")?.setItem(TOKEN_KEY, token);
    tokenListeners.forEach((l) => l());
  },
  clear() {
    const previous = tokenLoaded ? cachedToken : loadToken();
    tokenLoaded = true;
    cachedToken = null;
    safeStorage("session")?.removeItem(TOKEN_KEY);
    // Only drop the shared copy if it is ours, so logging out one tab does not
    // affect what a new tab would inherit from a different, newer login.
    const local = safeStorage("local");
    if (local && previous && local.getItem(TOKEN_KEY) === previous) {
      local.removeItem(TOKEN_KEY);
    }
    if (previous) tokenListeners.forEach((l) => l());
  },
  subscribe(listener: Listener): () => void {
    tokenListeners.add(listener);
    return () => {
      tokenListeners.delete(listener);
    };
  },
};

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
  const token = options.anonymous ? null : tokenStore.get();
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
    // An authenticated call that comes back 401 means our token is no longer valid.
    if (res.status === 401 && token && tokenStore.get() === token) {
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
