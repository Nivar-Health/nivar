import { Router } from 'express';
import { z } from 'zod';
import { Lead } from '../models/index.js';
import { validate } from '../middleware/validate.js';
import { phoneSchema } from '../lib/schemas.js';

const router = Router();

router.post(
  '/',
  validate(
    z.object({
      name: z.string().trim().min(1, 'Name is required').max(80),
      phone: phoneSchema,
      city: z.string().trim().min(1, 'City is required').max(80),
      message: z.string().trim().max(1000).optional(),
    }),
  ),
  async (req, res) => {
    await Lead.create(req.valid.body);
    res.status(201).json({ ok: true });
  },
);

export default router;
