import { z } from "zod";
import { withAuth } from "@/server/auth";
import { badRequest, json, notFound } from "@/server/errors";
import type { ProfileRow } from "@/server/mappers";
import { supabaseAdmin, supabaseAuthAdmin } from "@/server/supabase";
import { parseBody } from "@/server/validate";
import { STAFF_ROLES, UUID, rethrowDuplicate, staffFields, staffPatch, withActiveCounts } from "../../_lib";

const schema = z.object({ ...staffFields, isActive: z.boolean() }).partial();

export const PATCH = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    if (!UUID.test(params.id)) throw notFound("Staff member not found");
    const sb = supabaseAdmin();
    const { data: existing, error: loadError } = await sb.from("profiles").select("*").eq("id", params.id).in("role", STAFF_ROLES).maybeSingle();
    if (loadError) throw loadError;
    if (!existing) throw notFound("Staff member not found");

    const { password, ...data } = await parseBody(req, schema);
    if (data.isActive === false && existing.id === user.id) throw badRequest("You cannot deactivate your own account", "self_deactivate");

    // Credentials live in Supabase Auth; keep the sign-in email in step with the profile.
    const authPatch: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password) authPatch.password = password;
    if (data.email && data.email !== existing.email) Object.assign(authPatch, { email: data.email, email_confirm: true });
    if (Object.keys(authPatch).length) {
      const { error } = await supabaseAuthAdmin().auth.admin.updateUserById(params.id, authPatch);
      if (error) rethrowDuplicate(error, "email");
    }

    const patch = staffPatch(data);
    let row = existing as ProfileRow;
    if (Object.keys(patch).length) {
      const { data: updated, error } = await sb.from("profiles").update(patch).eq("id", params.id).select("*").single();
      if (error) rethrowDuplicate(error, /phone/i.test(error.message) ? "phone" : "email");
      row = updated as ProfileRow;
    }
    const [staff] = await withActiveCounts([row]);
    return json({ staff, user: staff });
  },
  { roles: ["admin"] },
);
