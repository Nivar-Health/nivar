"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UserAvatar } from "@/components/user-menu";
import { ROLE_LABEL, homePathForRole, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/**
 * Shown on sign-in pages when this tab already holds a session, so a demo
 * presenter can continue or sign in as someone else without logging out.
 */
export function SignedInNotice({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return null;
  return (
    <Link
      href={homePathForRole(user.role)}
      className="group mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <UserAvatar name={user.name} src={user.avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">Continue as {user.name}</span>
        <span className="block text-xs text-muted-foreground">
          Signed in as {ROLE_LABEL[user.role].toLowerCase()} in this tab
        </span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
