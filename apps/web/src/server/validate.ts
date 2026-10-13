import "server-only";
import { z } from "zod";
import { badRequest } from "./errors";
import { EXPRESS_SLOT, SLOTS, isValidDateStr } from "./time";

/** Parse with zod; the first issue becomes a 400 `validation_error`. */
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    throw badRequest(`${path}${issue?.message ?? "Invalid input"}`, "validation_error");
  }
  return result.data;
}

/** Read and validate a JSON body; an empty or malformed body validates as `{}`. */
export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.output<T>> {
  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest("Body must be valid JSON", "validation_error");
  }
  return parse(schema, body);
}

export function parseQuery<T extends z.ZodTypeAny>(req: Request, schema: T): z.output<T> {
  const url = new URL(req.url);
  return parse(schema, Object.fromEntries(url.searchParams.entries()));
}

/** Normalise an Indian mobile number to 10 digits, or return null if invalid. */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  let digits = String(input).replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** E.164 form Supabase Auth expects. */
export const toE164 = (phone10: string) => `+91${phone10}`;

export const phoneSchema = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) {
    ctx.addIssue({ code: "custom", message: "Enter a valid 10 digit Indian mobile number" });
    return z.NEVER;
  }
  return p;
});

export const uuidSchema = z.string().uuid("Invalid id");
export const dateSchema = z.string().refine(isValidDateStr, "Use YYYY-MM-DD");
const BOOKABLE_SLOTS = [EXPRESS_SLOT, ...SLOTS] as [string, ...string[]];
export const slotSchema = z.enum(BOOKABLE_SLOTS, { message: `Slot must be one of ${BOOKABLE_SLOTS.join(", ")}` });
export const genderSchema = z.enum(["male", "female", "other"]);

const trimmed = (max = 200) => z.string().trim().max(max);

export const addressInputSchema = z.object({
  id: z.string().optional(),
  label: trimmed(40).optional().default("Home"),
  line1: trimmed(300).min(1, "Address line is required"),
  area: trimmed(120).optional().default(""),
  city: trimmed(80).optional().default("Bangalore"),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .or(z.literal(""))
    .optional()
    .default(""),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export { trimmed };
