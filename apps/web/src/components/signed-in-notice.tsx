"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UserAvatar } from "@/components/user-menu";
import { ROLE_LABEL, homePathForRole, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/**
 * Shown on sign-in pages when this tab already holds a session, so a demo
 * presenter can continue or sign in as someone else without logging out.
 * Staff see which role the session is; a patient has only the one.
 */
export function SignedInNotice({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return null;
  return (
    <Link
      href={homePathForRole(user.role)}
      className="group mb-6 flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition-colors hover:border-primary/40 focus-ring"
    >
      <UserAvatar name={user.name} src={user.avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-medium">Continue as {user.name}</span>
        <span className="block text-sm text-muted-foreground">
          {user.role === "customer"
            ? "You are already signed in"
            : `You are already signed in as ${ROLE_LABEL[user.role].toLowerCase()}`}
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
}
