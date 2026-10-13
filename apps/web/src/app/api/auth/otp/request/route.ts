import { z } from "zod";
import { DEMO_OTP, isDemoPhone } from "@/server/demo";
import { badRequest, errorResponse, forbidden, json } from "@/server/errors";
import { supabaseAdmin, supabaseAnon } from "@/server/supabase";
import { parseBody, phoneSchema, toE164 } from "@/server/validate";

const bodySchema = z.object({ phone: phoneSchema });

/**
 * POST /api/auth/otp/request { phone } -> { ok, isNewUser, demoOtp? }
 * Sends the OTP through Supabase Auth; the browser then calls `auth.verifyOtp`.
 */
export async function POST(req: Request) {
  try {
    const { phone } = await parseBody(req, bodySchema);

    const { data: profile, error } = await supabaseAdmin()
      .from("profiles")
      .select("id, role, name")
      .eq("phone", phone)
      .maybeSingle();
    if (error) throw error;
    if (profile && profile.role !== "customer") {
      throw forbidden("Staff accounts sign in with email and password", "staff_account");
    }

    const { error: otpError } = await supabaseAnon().auth.signInWithOtp({
      phone: toE164(phone),
      options: { shouldCreateUser: true },
    });
    if (otpError) throw badRequest(otpError.message, "otp_failed");

    return json({
      ok: true,
      ...(isDemoPhone(phone) ? { demoOtp: DEMO_OTP } : {}),
      isNewUser: !profile || !profile.name,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
