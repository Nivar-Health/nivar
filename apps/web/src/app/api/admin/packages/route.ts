import { z } from "zod";
import { withAuth } from "@/server/auth";
import { json } from "@/server/errors";
import { packageToApi, serviceToApi, type PackageRow, type ServiceRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";
import { parseBody } from "@/server/validate";
import { packageFields, packagePatch, rethrowDuplicate } from "../_lib";

export const GET = withAuth(
  async () => {
    const sb = supabaseAdmin();
    const [packagesRes, servicesRes] = await Promise.all([
      sb.from("packages").select("*").order("sort_order", { ascending: true }).order("price", { ascending: true }),
      sb.from("services").select("*").order("sort_order", { ascending: true }).order("code", { ascending: true }),
    ]);
    if (packagesRes.error) throw packagesRes.error;
    if (servicesRes.error) throw servicesRes.error;
    return json({
      packages: ((packagesRes.data ?? []) as PackageRow[]).map(packageToApi),
      services: ((servicesRes.data ?? []) as ServiceRow[]).map(serviceToApi),
    });
  },
  { roles: ["admin"] },
);

const createSchema = z
  .object(packageFields)
  .partial()
  .required({ name: true, serviceCodes: true, price: true })
  .refine((p) => p.mrp === undefined || p.mrp >= p.price, { message: "MRP must be at least the price", path: ["mrp"] });

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const POST = withAuth(
  async (req) => {
    const body = await parseBody(req, createSchema);
    const sb = supabaseAdmin();
    let sortOrder = body.sortOrder;
    if (sortOrder === undefined) {
      const { count, error } = await sb.from("packages").select("id", { count: "exact", head: true });
      if (error) throw error;
      sortOrder = (count ?? 0) + 1;
    }
    const { data, error } = await sb
      .from("packages")
      .insert({
        tagline: "",
        description: "",
        popular: false,
        is_active: true,
        ...packagePatch(body),
        slug: body.slug || slugify(body.name),
        mrp: body.mrp ?? body.price,
        sort_order: sortOrder,
      })
      .select("*")
      .single();
    if (error) rethrowDuplicate(error, "slug");
    return json({ package: packageToApi(data as PackageRow) }, 201);
  },
  { roles: ["admin"] },
);
