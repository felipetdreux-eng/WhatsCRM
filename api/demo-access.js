import crypto from 'node:crypto';

const DEMOS = {
  jacob: {
    tokenSha256: 'f717ba93c3e57353a05e9a6e3d568865f42286c50fb7446add6d733517b27353',
    expiresAt: '2026-09-14T21:23:44.305612-03:00',
  },
  innova: {
    tokenSha256: '293307658be465d032c2dfbfefb0429a0a4baf5261ae6f656cdc5df6e75b7983',
    expiresAt: '2026-09-16T19:04:00-03:00',
  },
};

function safeEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') return response.status(405).json({ allowed: false, error: 'method_not_allowed' });

  const token = Array.isArray(request.query?.token) ? request.query.token[0] : request.query?.token;
  const requestedDemo = Array.isArray(request.query?.demo) ? request.query.demo[0] : request.query?.demo;
  const demoKey = requestedDemo === 'innova' || requestedDemo === 'innova-automation' ? 'innova' : 'jacob';
  const config = DEMOS[demoKey];

  const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const expiresAtMs = new Date(config.expiresAt).getTime();
  const now = Date.now();
  const expired = !Number.isFinite(expiresAtMs) || now >= expiresAtMs;
  const validToken = safeEqualHex(tokenHash, config.tokenSha256);
  const expiresInMs = expired ? 0 : Math.max(0, expiresAtMs - now);

  return response.status(200).json({
    allowed: validToken && !expired,
    expired,
    expiresAt: config.expiresAt,
    expiresInMs,
  });
}
