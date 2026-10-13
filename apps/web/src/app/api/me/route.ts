import { v4 as uuidv4, validate as isUuid } from "uuid";
import { z } from "zod";
import { withAuth } from "@/server/auth";
import { json } from "@/server/errors";
import { profileToUser, type ProfileRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";
import { istParts } from "@/server/time";
import { addressInputSchema, genderSchema, parseBody } from "@/server/validate";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  gender: genderSchema.optional(),
  dob: z.union([z.iso.date(), z.iso.datetime(), z.null()]).optional(),
  addresses: z.array(addressInputSchema).max(10).optional(),
});

/** A YYYY-MM-DD for the `date` column; a full timestamp is read as an IST calendar day. */
const toDateOnly = (dob: string): string => (dob.length === 10 ? dob : istParts(new Date(dob)).date);

/** PATCH /api/me { name?, gender?, dob?, addresses? } -> { user } */
export const PATCH = withAuth(async (req, { user }) => {
  const { name, gender, dob, addresses } = await parseBody(req, patchSchema);

  const patch: Partial<Pick<ProfileRow, "name" | "gender" | "dob" | "addresses">> = {};
  if (name !== undefined) patch.name = name;
  if (gender !== undefined) patch.gender = gender;
  if (dob !== undefined) patch.dob = dob ? toDateOnly(dob) : null;
  if (addresses !== undefined) {
    patch.addresses = addresses.map(({ id, ...a }) => ({ ...a, id: id && isUuid(id) ? id : uuidv4() }));
  }
  if (Object.keys(patch).length === 0) return json({ user });

  const { data, error } = await supabaseAdmin().from("profiles").update(patch).eq("id", user.id).select("*").single();
  if (error) throw error;
  return json({ user: profileToUser(data as ProfileRow) });
});
