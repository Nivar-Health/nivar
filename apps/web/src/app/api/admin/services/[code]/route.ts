import { z } from "zod";
import { withAuth } from "@/server/auth";
import { json, notFound } from "@/server/errors";
import { serviceToApi, type ServiceRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";
import { parseBody } from "@/server/validate";

const schema = z
  .object({
    price: z.number().min(0).optional(),
    description: z.string().trim().max(2000).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    shortName: z.string().trim().min(1).max(40).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const PATCH = withAuth<{ code: string }>(
  async (req, { params }) => {
    const body = await parseBody(req, schema);
    const patch: Record<string, unknown> = {};
    if (body.price !== undefined) patch.price = body.price;
    if (body.description !== undefined) patch.description = body.description;
    if (body.name !== undefined) patch.name = body.name;
    if (body.shortName !== undefined) patch.short_name = body.shortName;

    const { data, error } = await supabaseAdmin()
      .from("services")
      .update(patch)
      .eq("code", String(params.code).toUpperCase())
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound("Service not found");
    return json({ service: serviceToApi(data as ServiceRow) });
  },
  { roles: ["admin"] },
);
