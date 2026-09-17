import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://myllrhcgbrwfvtqxgkcb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Rs03JEyGR0ZRUByacZwIpw_4PfRcyKQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function readHeader(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (request.method !== 'POST') {
    return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const token = readHeader(request, 'x-fuply-waha-key');
  if (!token) {
    return response.status(401).json({ ok: false, error: 'missing_webhook_key' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return response.status(400).json({ ok: false, error: 'invalid_json' });
    }
  }

  if (!body || typeof body !== 'object') {
    return response.status(400).json({ ok: false, error: 'invalid_payload' });
  }

  const event = String(body.event || '');
  const session = String(body.session || 'default');
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
  const requestId = readHeader(request, 'x-webhook-request-id') || body.id || null;

  const { data, error } = await supabase.rpc('ingest_waha_event', {
    _webhook_token: token,
    _event: event,
    _session: session,
    _payload: payload,
    _request_id: requestId,
  });

  if (error) {
    const invalidKey = String(error.message || '').includes('invalid_webhook_token');
    console.error('WAHA webhook ingest failed:', error.message || error);
    return response.status(invalidKey ? 401 : 500).json({
      ok: false,
      error: invalidKey ? 'invalid_webhook_key' : 'ingest_failed',
    });
  }

  return response.status(202).json({ ok: true, ...(data || {}) });
}
