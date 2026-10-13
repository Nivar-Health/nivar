import { z } from "zod";
import { withAuth } from "@/server/auth";
import { badRequest, json, notFound } from "@/server/errors";
import { packageToApi, type PackageRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";
import { parseBody } from "@/server/validate";
import { UUID, packageFields, packagePatch, rethrowDuplicate } from "../../_lib";

const schema = z.object(packageFields).partial();

export const PATCH = withAuth<{ id: string }>(
  async (req, { params }) => {
    if (!UUID.test(params.id)) throw notFound("Package not found");
    const sb = supabaseAdmin();
    const { data: existing, error: loadError } = await sb.from("packages").select("*").eq("id", params.id).maybeSingle();
    if (loadError) throw loadError;
    if (!existing) throw notFound("Package not found");

    const body = await parseBody(req, schema);
    const patch = packagePatch(body);
    const merged = { ...(existing as PackageRow), ...patch } as PackageRow;
    if (merged.mrp < merged.price) throw badRequest("MRP must be at least the price", "validation_error");

    if (!Object.keys(patch).length) return json({ package: packageToApi(existing as PackageRow) });
    const { data, error } = await sb.from("packages").update(patch).eq("id", params.id).select("*").single();
    if (error) rethrowDuplicate(error, "slug");
    return json({ package: packageToApi(data as PackageRow) });
  },
  { roles: ["admin"] },
);
