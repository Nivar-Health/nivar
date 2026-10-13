import "server-only";
import type { NextRequest } from "next/server";
import type { Role, User } from "@/lib/types";
import { errorResponse, forbidden, unauthorized } from "./errors";
import { profileToUser, type ProfileRow } from "./mappers";
import { supabaseAdmin } from "./supabase";

export type AuthedUser = User & { role: Role };

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Resolve the signed-in user from the bearer token, or null. */
export async function userFromRequest(req: Request): Promise<AuthedUser | null> {
  const token = bearer(req);
  if (!token) return null;
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return null;
  return profileToUser(profile as ProfileRow) as AuthedUser;
}

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: { user: AuthedUser; params: P }) => Promise<Response>;
type AnonHandler<P> = (req: NextRequest, ctx: { user: AuthedUser | null; params: P }) => Promise<Response>;

/**
 * Wrap a route handler: resolves the user (401 if missing, 403 if the role is not allowed) and
 * turns thrown HttpErrors into `{ error }` responses.
 */
export function withAuth<P = Record<string, never>>(handler: Handler<P>, opts: { roles?: Role[] } = {}) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const user = await userFromRequest(req);
      if (!user) throw unauthorized();
      if (!user.isActive) throw forbidden("This account has been deactivated", "inactive");
      if (opts.roles && !opts.roles.includes(user.role)) {
        throw forbidden(`This action is only available to ${opts.roles.join(" or ")} accounts`, "role_not_allowed");
      }
      const params = await ctx.params;
      return await handler(req, { user, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Same as withAuth but the route also works signed out (`user` may be null). */
export function withOptionalAuth<P = Record<string, never>>(handler: AnonHandler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const user = await userFromRequest(req);
      const params = await ctx.params;
      return await handler(req, { user, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
