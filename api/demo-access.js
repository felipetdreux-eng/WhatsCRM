import crypto from 'node:crypto';

const DEMO_ALIASES = {
  jacob: 'jacob',
  able: 'able',
  'able-live': 'able',
  innova: 'innova',
  'innova-automation': 'innova',
};

const DEMO_ENV = {
  jacob: ['DEMO_JACOB_TOKEN_SHA256', 'DEMO_JACOB_EXPIRES_AT'],
  able: ['DEMO_ABLE_TOKEN_SHA256', 'DEMO_ABLE_EXPIRES_AT'],
  innova: ['DEMO_INNOVA_TOKEN_SHA256', 'DEMO_INNOVA_EXPIRES_AT'],
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
  const demoKey = DEMO_ALIASES[requestedDemo];
  if (!demoKey) return response.status(404).json({ allowed: false, error: 'demo_not_found' });

  const [hashVariable, expirationVariable] = DEMO_ENV[demoKey];
  const tokenSha256 = String(process.env[hashVariable] || '').trim().toLowerCase();
  const expiresAt = String(process.env[expirationVariable] || '').trim();
  if (!/^[0-9a-f]{64}$/.test(tokenSha256) || !expiresAt) {
    return response.status(503).json({ allowed: false, error: 'demo_not_configured' });
  }

  const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const expiresAtMs = new Date(expiresAt).getTime();
  const now = Date.now();
  const expired = !Number.isFinite(expiresAtMs) || now >= expiresAtMs;
  const validToken = safeEqualHex(tokenHash, tokenSha256);
  const expiresInMs = expired ? 0 : Math.max(0, expiresAtMs - now);

  return response.status(200).json({
    allowed: validToken && !expired,
    expired,
    expiresAt,
    expiresInMs,
  });
}
