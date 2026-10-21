// Typed fetch wrapper for the Nivar API, plus the per-tab session token store.
// The address, errors and JSON request live in lib/http.ts, which public pages import on their own.

import { ApiError, requestJson, type HttpMethod } from "@/lib/http";
import { getSupabase, peekStoredSession } from "@/lib/supabase";

export { API_BASE, API_ORIGIN, ApiError, errorMessage } from "@/lib/http";

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
// Request
// ---------------------------------------------------------------------------

export interface RequestOptions {
  signal?: AbortSignal;
  /** Skip attaching the bearer token. */
  anonymous?: boolean;
  headers?: Record<string, string>;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const token = options.anonymous ? null : await currentAccessToken();
  const headers = token ? { ...options.headers, Authorization: `Bearer ${token}` } : options.headers;
  try {
    return await requestJson<T>(method, path, body, { signal: options.signal, headers });
  } catch (err) {
    // An authenticated call that comes back 401 means our session is no longer valid.
    if (err instanceof ApiError && err.status === 401 && token && tokenStore.get() !== null) {
      tokenStore.clear();
    }
    throw err;
  }
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
