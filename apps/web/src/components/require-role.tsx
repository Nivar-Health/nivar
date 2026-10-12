"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FullScreenLoader } from "@/components/full-screen-loader";
import { homePathForRole, signedOutRecently, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/**
 * Renders children only for signed-in users with one of the given roles.
 * - loading: branded full-screen loader
 * - signed out: /login?next=... (customers) or /staff/login?next=... (staff)
 * - wrong role: that user's own home
 */
export function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const roles = Array.isArray(role) ? role : [role];
  const rolesKey = roles.join(",");
  const allowed = Boolean(user && roles.includes(user.role));

  useEffect(() => {
    if (loading || allowed) return;
    if (!user) {
      const accepted = rolesKey.split(",");
      const loginPath = accepted.includes("customer") ? "/login" : "/staff/login";
      const next = `${pathname}${window.location.search}`;
      router.replace(signedOutRecently() ? loginPath : `${loginPath}?next=${encodeURIComponent(next)}`);
    } else {
      router.replace(homePathForRole(user.role));
    }
  }, [loading, allowed, user, rolesKey, pathname, router]);

  if (!allowed) return <FullScreenLoader label={loading ? "Loading" : "Redirecting"} />;
  return <>{children}</>;
}
export { FullScreenLoader } from "@/components/full-screen-loader";
