"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ApiError, api, tokenStore } from "@/lib/api";
import type { AuthResponse, OtpRequestResponse, Role, User } from "@/lib/types";

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
  token: string;
  user: User | null;
  /** Set when /auth/me failed for a reason other than 401 (e.g. API offline). */
  failed?: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const token = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.get(),
    () => null,
  );
  const [session, setSession] = useState<Session | null>(null);

  // Validate whichever token this tab holds. A 401 clears the token inside api.ts.
  useEffect(() => {
    if (!token || session?.token === token) return;
    let cancelled = false;
    api
      .get<{ user: User }>("/auth/me")
      .then(({ user }) => {
        if (!cancelled) setSession({ token, user });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return; // token cleared already
        setSession({ token, user: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [token, session?.token]);

  const current = session && token && session.token === token ? session : null;
  const user = current?.user ?? null;
  const loading = !hydrated || (token !== null && current === null);

  const applyAuth = useCallback(({ token: next, user: nextUser }: AuthResponse) => {
    setSession({ token: next, user: nextUser });
    tokenStore.set(next);
    return nextUser;
  }, []);

  const requestOtp = useCallback(
    (phone: string) =>
      api.post<OtpRequestResponse>("/auth/otp/request", { phone }, { anonymous: true }),
    [],
  );

  const loginWithOtp = useCallback(
    async (phone: string, otp: string, name?: string) => {
      const res = await api.post<AuthResponse>(
        "/auth/otp/verify",
        { phone, otp, ...(name ? { name } : {}) },
        { anonymous: true },
      );
      return applyAuth(res);
    },
    [applyAuth],
  );

  const loginStaff = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<AuthResponse>(
        "/auth/login",
        { email, password },
        { anonymous: true },
      );
      return applyAuth(res);
    },
    [applyAuth],
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
      const { user: fresh } = await api.get<{ user: User }>("/auth/me");
      setSession({ token: t, user: fresh });
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const setUser = useCallback((next: User) => {
    const t = tokenStore.get();
    if (t) setSession({ token: t, user: next });
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
