import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Nenhuma chamada pode sair para a rede: o fetch global é trocado por um
// falso antes de importar os handlers (o cliente Supabase resolve fetch na hora da chamada).
const realFetch = globalThis.fetch;
let fetchHandler = null;
const fetchCalls = [];
globalThis.fetch = async (url, init = {}) => {
  fetchCalls.push({ url: String(url), init });
  if (!fetchHandler) throw new Error(`rede bloqueada no teste: ${url}`);
  return fetchHandler(String(url), init);
};

const { default: demoAccess } = await import('../api/demo-access.js');
const { default: wahaWebhook } = await import('../api/waha-webhook.js');

function fakeResponse() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
}

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  fetchHandler = null;
  fetchCalls.length = 0;
});

test.after(() => { globalThis.fetch = realFetch; });

// ---------- /api/demo-access ----------

test('demo-access: só GET e sempre sem cache', () => {
  const res = fakeResponse();
  demoAccess({ method: 'POST', query: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['cache-control'], 'no-store, max-age=0');
});

test('demo-access: token errado ou ausente nunca libera', () => {
  for (const token of [undefined, '', 'chute', ['a', 'b']]) {
    const res = fakeResponse();
    demoAccess({ method: 'GET', query: { token, demo: 'jacob' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.allowed, false);
  }
});

test('demo-access: demo desconhecida cai na jacob e o hash não vaza na resposta', () => {
  const res = fakeResponse();
  demoAccess({ method: 'GET', query: { demo: '../../etc', token: 'x' } }, res);
  assert.equal(res.body.allowed, false);
  assert.ok(!JSON.stringify(res.body).includes('f717ba93'));
});

test('demo-access: depois do prazo fica expirada com 0 ms restantes', () => {
  const originalNow = Date.now;
  Date.now = () => new Date('2026-12-01T00:00:00Z').getTime();
  try {
    const res = fakeResponse();
    demoAccess({ method: 'GET', query: { demo: 'innova', token: 'x' } }, res);
    assert.equal(res.body.expired, true);
    assert.equal(res.body.expiresInMs, 0);
  } finally {
    Date.now = originalNow;
  }
});

test('demo-access: antes do prazo informa o tempo restante', () => {
  const originalNow = Date.now;
  const expiresAt = new Date('2026-09-16T19:04:00-03:00').getTime();
  Date.now = () => expiresAt - 60000;
  try {
    const res = fakeResponse();
    demoAccess({ method: 'GET', query: { demo: 'innova-automation', token: 'x' } }, res);
    assert.equal(res.body.expired, false);
    assert.equal(res.body.expiresInMs, 60000);
    assert.equal(res.body.allowed, false, 'sem o token certo continua bloqueado');
  } finally {
    Date.now = originalNow;
  }
});

// ---------- /api/waha-webhook ----------

test('waha-webhook: recusa método diferente de POST', async () => {
  const res = fakeResponse();
  await wahaWebhook({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(fetchCalls.length, 0);
});

test('waha-webhook: sem chave responde 401 sem consultar o banco', async () => {
  const res = fakeResponse();
  await wahaWebhook({ method: 'POST', headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'missing_webhook_key');
  assert.equal(fetchCalls.length, 0);
});

test('waha-webhook: JSON inválido e payload não-objeto viram 400', async () => {
  for (const body of ['{quebrado', null, 'null', 42]) {
    const res = fakeResponse();
    await wahaWebhook({ method: 'POST', headers: { 'x-fuply-waha-key': 'k' }, body }, res);
    assert.equal(res.statusCode, 400, `body ${JSON.stringify(body)}`);
  }
  assert.equal(fetchCalls.length, 0);
});

test('waha-webhook: repassa evento para a RPC com chave, sessão padrão e request id', async () => {
  let sent;
  fetchHandler = (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return jsonResponse(200, { accepted: true, stored: true });
  };
  const res = fakeResponse();
  await wahaWebhook({
    method: 'POST',
    headers: { 'x-fuply-waha-key': ['chave-1', 'chave-2'], 'x-webhook-request-id': 'req-1' },
    body: JSON.stringify({ event: 'message', payload: { id: 'm1', body: 'oi' } }),
  }, res);
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { ok: true, accepted: true, stored: true });
  assert.match(sent.url, /\/rest\/v1\/rpc\/ingest_waha_event$/);
  assert.deepEqual(sent.body, {
    _webhook_token: 'chave-1',
    _event: 'message',
    _session: 'default',
    _payload: { id: 'm1', body: 'oi' },
    _request_id: 'req-1',
  });
});

test('waha-webhook: payload que não é objeto vira {}', async () => {
  let sent;
  fetchHandler = (_url, init) => { sent = JSON.parse(init.body); return jsonResponse(200, {}); };
  const res = fakeResponse();
  await wahaWebhook({ method: 'POST', headers: { 'x-fuply-waha-key': 'k' }, body: { event: 'message', payload: 'texto', id: 'b1' } }, res);
  assert.deepEqual(sent._payload, {});
  assert.equal(sent._request_id, 'b1');
});

test('waha-webhook: chave inválida no banco vira 401; outro erro vira 500 sem detalhes', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    fetchHandler = () => jsonResponse(400, { message: 'invalid_webhook_token', code: 'P0001' });
    let res = fakeResponse();
    await wahaWebhook({ method: 'POST', headers: { 'x-fuply-waha-key': 'k' }, body: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'invalid_webhook_key');

    fetchHandler = () => jsonResponse(500, { message: 'relation leads does not exist', code: '42P01' });
    res = fakeResponse();
    await wahaWebhook({ method: 'POST', headers: { 'x-fuply-waha-key': 'k' }, body: {} }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { ok: false, error: 'ingest_failed' });
  } finally {
    console.error = originalError;
  }
});
