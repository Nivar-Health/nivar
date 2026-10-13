import type { Lead } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { json } from "@/server/errors";
import { supabaseAdmin } from "@/server/supabase";

type LeadRow = { id: string; name: string; phone: string; city: string; message: string; created_at: string };

export const GET = withAuth(
  async () => {
    const { data, error } = await supabaseAdmin().from("leads").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const leads: Lead[] = ((data ?? []) as LeadRow[]).map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      city: l.city,
      message: l.message,
      createdAt: l.created_at,
    }));
    return json({ leads });
  },
  { roles: ["admin"] },
);
