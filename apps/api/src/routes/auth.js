import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { signToken } from '../lib/jwt.js';
import { phoneSchema } from '../lib/schemas.js';
import { badRequest, forbidden, unauthorized } from '../lib/errors.js';
import { config } from '../config.js';

const router = Router();

router.post('/otp/request', validate(z.object({ phone: phoneSchema })), async (req, res) => {
  const { phone } = req.valid.body;
  const existing = await User.findOne({ phone });
  if (existing && existing.role !== 'customer') throw forbidden('Staff accounts sign in with email and password', 'staff_account');
  res.json({ ok: true, demoOtp: config.demoOtp, isNewUser: !existing });
});

router.post(
  '/otp/verify',
  validate(z.object({ phone: phoneSchema, otp: z.union([z.string(), z.number()]).transform(String), name: z.string().trim().max(80).optional() })),
  async (req, res) => {
    const { phone, otp, name } = req.valid.body;
    if (otp.trim() !== config.demoOtp) throw badRequest('Incorrect OTP. For the demo, use 123456', 'invalid_otp');
    let user = await User.findOne({ phone });
    if (user && user.role !== 'customer') throw forbidden('Staff accounts sign in with email and password', 'staff_account');
    if (!user) {
      user = await User.create({ role: 'customer', phone, name: name || '', addresses: [] });
    } else if (name && !user.name) {
      user.name = name;
      await user.save();
    }
    if (!user.isActive) throw forbidden('This account has been deactivated', 'inactive');
    res.json({ token: signToken(user), user: user.toJSON() });
  },
);

router.post(
  '/login',
  validate(z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Password is required') })),
  async (req, res) => {
    const { email, password } = req.valid.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw unauthorized('Incorrect email or password', 'invalid_credentials');
    if (!user.isActive) throw forbidden('This account has been deactivated', 'inactive');
    res.json({ token: signToken(user), user: user.toJSON() });
  },
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toJSON() });
});

export default router;
