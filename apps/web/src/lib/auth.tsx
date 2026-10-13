"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ApiError, api, tokenStore } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { OtpRequestResponse, Role, User } from "@/lib/types";

export function homePathForRole(role: Role): string {
  switch (role) {
    case "customer":
      return "/app";
    case "nurse":
      return "/nurse";
    case "doctor":
      return "/doctor";
    case "admin":
      return "/admin";
  }
}

/** Where a given role views a booking. */
export function bookingPathForRole(role: Role, bookingId: string): string {
  switch (role) {
    case "customer":
      return `/app/bookings/${bookingId}`;
    case "nurse":
      return `/nurse/visits/${bookingId}`;
    case "doctor":
      return `/doctor/consults/${bookingId}`;
    case "admin":
      return `/admin/bookings/${bookingId}`;
  }
}

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Patient",
  nurse: "Nurse",
  doctor: "Doctor",
  admin: "Admin",
};

/** Accepts only same-origin absolute paths for `?next=` redirects. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Phone numbers, normalised exactly like the server (server/validate.ts).
// ---------------------------------------------------------------------------

/** Normalise an Indian mobile number to 10 digits, or return null if invalid. */
function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** E.164 form Supabase Auth expects. */
const toE164 = (phone10: string) => `+91${phone10}`;

/** The `sub` claim of a JWT, without verifying it (identity key only; the server verifies). */
function subjectOf(token: string): string {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : token;
  } catch {
    return token;
  }
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True until the stored session has been read and validated against /auth/me. */
  loading: boolean;
  requestOtp: (phone: string) => Promise<OtpRequestResponse>;
  loginWithOtp: (phone: string, otp: string, name?: string) => Promise<User>;
  loginStaff: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<User | null>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let lastLogoutAt = 0;

/** True right after an explicit sign out, so guards skip the `?next=` round trip. */
export function signedOutRecently(): boolean {
  return Date.now() - lastLogoutAt < 3000;
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

interface Session {
  /** Identity of the signed-in user (JWT subject), stable across token refreshes. */
  key: string;
  user: User | null;
  /** Set when /auth/me failed for a reason other than 401 (e.g. API offline). */
  failed?: boolean;
}

async function fetchMe(): Promise<User> {
  const { user } = await api.get<{ user: User }>("/auth/me");
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const token = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.get(),
    () => null,
  );
  const key = token ? subjectOf(token) : null;
  const [session, setSession] = useState<Session | null>(null);
  /** True while a login call is fetching /auth/me itself, so the effect below does not duplicate it. */
  const signingIn = useRef(false);

  // Validate whichever session this tab holds. A 401 clears the session inside api.ts.
  useEffect(() => {
    if (!key || session?.key === key || signingIn.current) return;
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (!cancelled) setSession({ key, user });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return; // session cleared already
        setSession({ key, user: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key, session?.key]);

  const current = session && key && session.key === key ? session : null;
  const user = current?.user ?? null;
  const loading = !hydrated || (token !== null && current === null);

  const requestOtp = useCallback((phone: string) => {
    const phone10 = normalizePhone(phone);
    if (!phone10) {
      return Promise.reject(new ApiError(400, "Enter a valid 10 digit Indian mobile number.", "validation_error"));
    }
    return api.post<OtpRequestResponse>("/auth/otp/request", { phone: phone10 }, { anonymous: true });
  }, []);

  /** Loads the profile for a freshly created Supabase session and adopts it. */
  const completeSignIn = useCallback(async (accessToken: string, check?: (user: User) => Promise<User>) => {
    signingIn.current = true;
    try {
      let me = await fetchMe();
      if (check) me = await check(me);
      setSession({ key: subjectOf(accessToken), user: me });
      return me;
    } finally {
      signingIn.current = false;
    }
  }, []);

  const loginWithOtp = useCallback(
    async (phone: string, otp: string, name?: string) => {
      const phone10 = normalizePhone(phone);
      if (!phone10) throw new ApiError(400, "Enter a valid 10 digit Indian mobile number.", "validation_error");
      const { data, error } = await getSupabase().auth.verifyOtp({
        phone: toE164(phone10),
        token: otp.trim(),
        type: "sms",
      });
      if (error || !data.session) {
        throw new ApiError(400, "That code is not correct or has expired", "invalid_otp");
      }
      const trimmed = name?.trim();
      return completeSignIn(data.session.access_token, async (me) => {
        if (trimmed && !me.name?.trim()) {
          const { user: updated } = await api.patch<{ user: User }>("/me", { name: trimmed });
          return updated ?? { ...me, name: trimmed };
        }
        return me;
      });
    },
    [completeSignIn],
  );

  const loginStaff = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
      }
      return completeSignIn(data.session.access_token, async (me) => {
        if (me.role === "customer") {
          tokenStore.clear();
          throw new ApiError(403, "Use the patient sign in for this account", "forbidden");
        }
        return me;
      });
    },
    [completeSignIn],
  );

  const logout = useCallback(() => {
    lastLogoutAt = Date.now();
    tokenStore.clear();
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    const t = tokenStore.get();
    if (!t) return null;
    try {
      const fresh = await fetchMe();
      setSession({ key: subjectOf(t), user: fresh });
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const setUser = useCallback((next: User) => {
    const t = tokenStore.get();
    if (t) setSession({ key: subjectOf(t), user: next });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: current ? token : null,
      loading,
      requestOtp,
      loginWithOtp,
      loginStaff,
      logout,
      refresh,
      setUser,
    }),
    [user, current, token, loading, requestOtp, loginWithOtp, loginStaff, logout, refresh, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
