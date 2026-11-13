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

const MENU_ROW = "min-h-11 gap-2.5 px-2.5 text-sm";

export interface UserMenuLink {
  href: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Avatar button with a dropdown: identity header, optional links, sign out.
 * The button looks 36px and takes taps on 44px; menu rows are 44px tall.
 */
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
        // The name a screen reader hears includes the name on screen; the initials are decoration.
        aria-label={user.name ? `Account menu, ${user.name}` : "Account menu"}
        className={cn(
          "relative flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors before:absolute before:-inset-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 data-popup-open:bg-muted",
          showName && "pr-2",
          className,
        )}
      >
        <span aria-hidden className="flex">
          <UserAvatar name={user.name} src={user.avatarUrl} />
        </span>
        {showName && (
          <>
            <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <UserAvatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-small font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem key={link.href} onClick={() => router.push(link.href)} className={MENU_ROW}>
            {link.icon}
            {link.label}
          </DropdownMenuItem>
        ))}
        {links.length > 0 && <DropdownMenuSeparator />}
        {/* Signing out is not dangerous, so it is not red. */}
        <DropdownMenuItem onClick={signOut} className={MENU_ROW}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
