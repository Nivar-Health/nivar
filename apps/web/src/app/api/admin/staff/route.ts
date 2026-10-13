import { z } from "zod";
import { withAuth } from "@/server/auth";
import { json } from "@/server/errors";
import type { ProfileRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";
import { parseBody, parseQuery } from "@/server/validate";
import { STAFF_ROLES, rethrowDuplicate, staffFields, staffPatch, withActiveCounts } from "../_lib";

export const GET = withAuth(
  async (req) => {
    const { role } = parseQuery(req, z.object({ role: z.enum(STAFF_ROLES).optional() }));
    let q = supabaseAdmin().from("profiles").select("*");
    q = role ? q.eq("role", role) : q.in("role", ["nurse", "doctor"]);
    const { data, error } = await q.order("is_active", { ascending: false }).order("name", { ascending: true });
    if (error) throw error;
    return json({ staff: await withActiveCounts((data ?? []) as ProfileRow[]) });
  },
  { roles: ["admin"] },
);

export const POST = withAuth(
  async (req) => {
    const { password, ...data } = await parseBody(req, z.object(staffFields));
    const sb = supabaseAdmin();

    const { data: created, error: authError } = await sb.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { name: data.name, role: data.role },
    });
    if (authError || !created.user) rethrowDuplicate(authError ?? new Error("Could not create the user"), "email");

    // The auth trigger creates a bare profile; fill in the staff fields on top of it.
    const { data: profile, error } = await sb
      .from("profiles")
      .upsert({ id: created.user.id, ...staffPatch(data), is_active: true }, { onConflict: "id" })
      .select("*")
      .single();
    if (error) {
      // Do not leave an auth user without a usable profile behind.
      await sb.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      rethrowDuplicate(error, data.phone && /phone/i.test(error.message) ? "phone" : "email");
    }
    const [staff] = await withActiveCounts([profile as ProfileRow]);
    return json({ staff, user: staff }, 201);
  },
  { roles: ["admin"] },
);
