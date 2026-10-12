import { User } from '../models/index.js';
import { verifyToken } from '../lib/jwt.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { isObjectId } from '../lib/ids.js';

/** Resolve a JWT to an active user document, or null. */
export async function userFromToken(token) {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub || !isObjectId(payload.sub)) return null;
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) return null;
  return user;
}

export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized();
  const user = await userFromToken(token);
  if (!user) throw unauthorized('Your session has expired, please sign in again', 'invalid_token');
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden(`This action requires role: ${roles.join(' or ')}`, 'role_not_allowed');
    next();
  };
}
