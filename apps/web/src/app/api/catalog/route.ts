import { errorResponse, json } from "@/server/errors";
import { packageToApi, serviceToApi, type PackageRow, type ServiceRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";

/** Public catalogue: every service, and the active packages. */
export async function GET() {
  try {
    const sb = supabaseAdmin();
    const [services, packages] = await Promise.all([
      sb.from("services").select("*").order("sort_order", { ascending: true }).order("code", { ascending: true }),
      sb
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("price", { ascending: true }),
    ]);
    if (services.error) throw services.error;
    if (packages.error) throw packages.error;
    return json({
      services: ((services.data ?? []) as ServiceRow[]).map(serviceToApi),
      packages: ((packages.data ?? []) as PackageRow[]).map(packageToApi),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
