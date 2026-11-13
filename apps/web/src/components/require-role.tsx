"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import { FullScreenLoader } from "@/components/full-screen-loader";
import { Button } from "@/components/ui/button";
import { homePathForRole, signedOutRecently, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/**
 * Renders children only for signed-in users with one of the given roles.
 * - loading: branded full-screen loader
 * - session held but the API cannot be reached: a retry screen; the person stays signed in
 * - signed out: /login?next=... (customers) or /staff/login?next=... (staff), with
 *   `reason=expired` when the session ended by itself
 * - wrong role: that user's own home
 */
export function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { user, loading, unreachable, sessionEnded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const roles = Array.isArray(role) ? role : [role];
  const rolesKey = roles.join(",");
  const allowed = Boolean(user && roles.includes(user.role));

  useEffect(() => {
    if (loading || allowed || unreachable) return;
    if (!user) {
      const accepted = rolesKey.split(",");
      const loginPath = accepted.includes("customer") ? "/login" : "/staff/login";
      const params = new URLSearchParams();
      if (!signedOutRecently()) params.set("next", `${pathname}${window.location.search}`);
      if (sessionEnded) params.set("reason", "expired");
      router.replace(params.size ? `${loginPath}?${params}` : loginPath);
    } else {
      router.replace(homePathForRole(user.role));
    }
  }, [loading, allowed, unreachable, sessionEnded, user, rolesKey, pathname, router]);

  if (allowed) return <>{children}</>;
  if (unreachable) return <Unreachable />;
  return <FullScreenLoader label={loading ? "Loading" : "One moment"} />;
}

/** The API did not answer while opening the app. Retries by button, and by itself once the network is back. */
function Unreachable() {
  const { refresh } = useAuth();
  const [trying, setTrying] = useState(false);

  const retry = async () => {
    if (trying) return;
    setTrying(true);
    await refresh();
    setTrying(false);
  };
  const retryWhenBack = useEffectEvent(() => void retry());

  useEffect(() => {
    const whenVisible = () => {
      if (document.visibilityState === "visible") retryWhenBack();
    };
    const whenOnline = () => retryWhenBack();
    window.addEventListener("online", whenOnline);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      window.removeEventListener("online", whenOnline);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-background px-6 py-10">
      <div role="alert" className="flex w-full max-w-sm flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full border border-border bg-card text-foreground">
          <WifiOff className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-2xl leading-tight font-semibold">Can&apos;t reach Nivar right now</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Check your connection, then try again. You are still signed in.
        </p>
        <Button
          onClick={() => void retry()}
          aria-busy={trying}
          className="mt-6 h-14 w-full rounded-full text-base font-semibold sm:h-12 sm:w-auto sm:px-8"
        >
          {trying ? <LoaderCircle className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          {trying ? "Trying again…" : "Try again"}
        </Button>
      </div>
    </div>
  );
}

export { FullScreenLoader } from "@/components/full-screen-loader";
