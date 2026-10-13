import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to apps/web/.env.local (see .env.example).`);
  return v;
}

export const SUPABASE_URL = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = () => required("SUPABASE_SERVICE_ROLE_KEY");

let db: SupabaseClient | null = null;
let authAdmin: SupabaseClient | null = null;

/**
 * Service-role client for database access (`from`, `rpc`). Bypasses RLS; server only.
 *
 * It is created with a fixed `accessToken`, so supabase-js never consults its own auth session.
 * Without this, every query waits on the auth client's session lock, and because one client
 * serves every request, concurrent requests queue behind each other (seconds under load).
 * Its `.auth` namespace is disabled; use `supabaseAuthAdmin()` for auth calls.
 */
export function supabaseAdmin(): SupabaseClient {
  const key = SUPABASE_SERVICE_ROLE_KEY();
  db ??= createClient(SUPABASE_URL(), key, { accessToken: async () => key });
  return db;
}

/** Service-role client for Supabase Auth: verifying user tokens and `auth.admin.*`. */
export function supabaseAuthAdmin(): SupabaseClient {
  authAdmin ??= createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return authAdmin;
}

/** Anon client for auth calls made on the user's behalf (for example sending an OTP). */
export function supabaseAnon(): SupabaseClient {
  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
