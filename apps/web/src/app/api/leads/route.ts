import { z } from "zod";
import { badRequest, errorResponse, json } from "@/server/errors";
import { supabaseAdmin } from "@/server/supabase";
import { parseBody, phoneSchema } from "@/server/validate";

const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: phoneSchema,
  city: z.string().trim().min(1, "City is required").max(80),
  message: z.string().trim().max(1000).optional(),
  /** The form's hidden field. People never see it; scripts that fill every field do. */
  website: z.string().max(200).optional(),
});

/** POST /api/leads: landing page callback form. */
export async function POST(req: Request) {
  try {
    const { name, phone, city, message, website } = await parseBody(req, leadSchema);
    if (website?.trim()) throw badRequest("We could not send this request.", "validation_error");
    const { error } = await supabaseAdmin().from("leads").insert({ name, phone, city, message: message ?? "" });
    if (error) throw error;
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
