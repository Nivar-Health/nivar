// Browser Supabase client with a per-tab session store (spec section 3).
//
// The session lives in sessionStorage so every tab can hold a different role during
// the demo, and is mirrored to localStorage so a freshly opened tab inherits the most
// recent login. This mirrors the old JWT token store exactly.

import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";

/** Key under which the session is actually stored (shared by all tabs). */
const SHARED_KEY = "nivar-auth";

/**
 * Supabase keys its cross-tab BroadcastChannel by `storageKey`. A per-tab key keeps a
 * sign in or sign out in one tab from being announced to the others, which would break
 * the four-window demo. The storage adapter below maps this key back to SHARED_KEY.
 */
const TAB_KEY = `${SHARED_KEY}-tab-${Math.random().toString(36).slice(2, 10)}`;

function storage(kind: "session" | "local"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function read(kind: "session" | "local", key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: "session" | "local", key: string, value: string | null) {
  try {
    const s = storage(kind);
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Storage blocked (private mode, quota): the in-memory session still works for this page.
  }
}

/** Translates Supabase's per-tab key (and derived keys such as `-code-verifier`) to the shared key. */
function sharedKey(key: string): string {
  return key.startsWith(TAB_KEY) ? `${SHARED_KEY}${key.slice(TAB_KEY.length)}` : key;
}

interface StoredSession {
  access_token?: string;
  expires_at?: number;
  user?: { id?: string };
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as StoredSession) : null;
  } catch {
    return null;
  }
}

/**
 * Picks the value a tab should use. The tab's own copy decides *who* is signed in; the
 * shared copy is adopted when it is missing here, or when it is a newer session for the
 * same user (another tab refreshed the shared refresh token, which rotates it).
 */
function resolve(key: string): string | null {
  const own = read("session", key);
  const shared = read("local", key);
  if (!own) {
    if (shared) write("session", key, shared);
    return shared;
  }
  if (shared && shared !== own) {
    const a = parseSession(own);
    const b = parseSession(shared);
    if (a?.user?.id && a.user.id === b?.user?.id && (b.expires_at ?? 0) > (a.expires_at ?? 0)) {
      write("session", key, shared);
      return shared;
    }
  }
  return own;
}

const perTabStorage: SupportedStorage = {
  getItem(key) {
    return resolve(sharedKey(key));
  },
  setItem(key, value) {
    const k = sharedKey(key);
    write("session", k, value);
    write("local", k, value);
  },
  removeItem(key) {
    const k = sharedKey(key);
    const previous = read("session", k);
    write("session", k, null);
    // Only drop the shared copy if it is ours, so signing out one tab does not affect
    // what a new tab would inherit from a different, newer login.
    if (previous !== null && read("local", k) === previous) write("local", k, null);
  },
};

/** Synchronous peek at the stored session, for the first render before Supabase has initialised. */
export function peekStoredSession(): { accessToken: string; userId: string | null } | null {
  if (typeof window === "undefined") return null;
  const s = parseSession(resolve(SHARED_KEY));
  if (!s?.access_token) return null;
  return { accessToken: s.access_token, userId: s.user?.id ?? null };
}

let client: SupabaseClient | null = null;

/**
 * The browser Supabase client. Created lazily on first use so builds and SSR without
 * env vars never crash; calling it without NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY throws.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Add them to apps/web/.env.local (see .env.example).",
    );
  }
  client = createClient(url, anonKey, {
    auth: {
      storage: perTabStorage,
      storageKey: TAB_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
