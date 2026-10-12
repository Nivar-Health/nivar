import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addressInputSchema, genderSchema } from '../lib/schemas.js';
import { isObjectId } from '../lib/ids.js';

const router = Router();

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  gender: genderSchema.optional(),
  dob: z.union([z.iso.date(), z.iso.datetime(), z.null()]).optional(),
  addresses: z.array(addressInputSchema).max(10).optional(),
});

router.patch('/', requireAuth, validate(patchSchema), async (req, res) => {
  const { name, gender, dob, addresses } = req.valid.body;
  const user = req.user;
  if (name !== undefined) user.name = name;
  if (gender !== undefined) user.gender = gender;
  if (dob !== undefined) user.dob = dob ? new Date(dob) : undefined;
  if (addresses !== undefined) {
    user.addresses = addresses.map(({ id, ...a }) => ({
      ...a,
      _id: id && isObjectId(id) ? id : new mongoose.Types.ObjectId(),
    }));
  }
  await user.save();
  res.json({ user: user.toJSON() });
});

export default router;
