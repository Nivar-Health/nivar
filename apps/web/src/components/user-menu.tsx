"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL, useAuth } from "@/lib/auth";
import { formatPhone, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  src,
  size = "default",
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export interface UserMenuLink {
  href: string;
  label: string;
  icon?: ReactNode;
}

/** Avatar button with a dropdown: identity header, optional links, sign out. */
export function UserMenu({
  links = [],
  showName = false,
  className,
}: {
  links?: UserMenuLink[];
  showName?: boolean;
  className?: string;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const subtitle = user.email ?? (user.phone ? formatPhone(user.phone) : ROLE_LABEL[user.role]);

  const signOut = () => {
    const loginPath = user.role === "customer" ? "/login" : "/staff/login";
    logout();
    router.replace(loginPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 data-popup-open:bg-muted",
          showName && "pr-2",
          className,
        )}
      >
        <UserAvatar name={user.name} src={user.avatarUrl} />
        {showName && (
          <>
            <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 p-1.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem key={link.href} onClick={() => router.push(link.href)} className="px-2 py-1.5">
            {link.icon}
            {link.label}
          </DropdownMenuItem>
        ))}
        {links.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" onClick={signOut} className="px-2 py-1.5">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
