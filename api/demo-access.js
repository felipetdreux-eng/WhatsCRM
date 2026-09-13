import crypto from 'node:crypto';

const JACOB_TOKEN_SHA256 = 'f717ba93c3e57353a05e9a6e3d568865f42286c50fb7446add6d733517b27353';
const JACOB_EXPIRES_AT = '2026-09-14T21:23:44.305612-03:00';

function safeEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') return response.status(405).json({ allowed: false, error: 'method_not_allowed' });

  const token = Array.isArray(request.query?.token) ? request.query.token[0] : request.query?.token;
  const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const expiresAtMs = new Date(JACOB_EXPIRES_AT).getTime();
  const now = Date.now();
  const expired = !Number.isFinite(expiresAtMs) || now >= expiresAtMs;
  const validToken = safeEqualHex(tokenHash, JACOB_TOKEN_SHA256);
  const expiresInMs = expired ? 0 : Math.max(0, expiresAtMs - now);

  return response.status(200).json({
    allowed: validToken && !expired,
    expired,
    expiresAt: JACOB_EXPIRES_AT,
    expiresInMs,
  });
}
