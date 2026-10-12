// Shared zod schemas.
import { z } from 'zod';
import { normalizePhone } from './phone.js';
import { EXPRESS_SLOT, isValidDateStr, SLOTS } from './time.js';

export const phoneSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid 10 digit Indian mobile number' });
      return z.NEVER;
    }
    return p;
  });

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const dateSchema = z.string().refine(isValidDateStr, 'Use YYYY-MM-DD');
const BOOKABLE_SLOTS = [EXPRESS_SLOT, ...SLOTS];
export const slotSchema = z.enum(BOOKABLE_SLOTS, { message: `Slot must be one of ${BOOKABLE_SLOTS.join(', ')}` });

const trimmed = (max = 200) => z.string().trim().max(max);

export const addressInputSchema = z.object({
  id: z.string().optional(),
  label: trimmed(40).optional().default('Home'),
  line1: trimmed(300).min(1, 'Address line is required'),
  area: trimmed(120).optional().default(''),
  city: trimmed(80).optional().default('Bangalore'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits').or(z.literal('')).optional().default(''),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const genderSchema = z.enum(['male', 'female', 'other']);
export { trimmed };
