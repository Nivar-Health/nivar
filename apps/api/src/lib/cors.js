import { config } from '../config.js';

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost)(:\d+)?$/i;

/** cors `origin` callback: WEB_ORIGIN always; any localhost origin outside production. */
export function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true); // same-origin, curl, server-to-server
  const allowed = config.webOrigin.split(',').map((s) => s.trim());
  if (allowed.includes(origin) || (!config.isProd && LOCALHOST.test(origin))) return cb(null, true);
  cb(null, false);
}
