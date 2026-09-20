import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/demo-access.js';

function invoke(query) {
  const result = { statusCode: 200, headers: {}, body: null };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return result; },
  };
  return handler({ method: 'GET', query }, response);
}

test('nega demonstração sem configuração no ambiente', () => {
  const previousHash = process.env.DEMO_ABLE_TOKEN_SHA256;
  const previousExpiration = process.env.DEMO_ABLE_EXPIRES_AT;
  delete process.env.DEMO_ABLE_TOKEN_SHA256;
  delete process.env.DEMO_ABLE_EXPIRES_AT;
  try {
    const response = invoke({ demo: 'able', token: 'qualquer' });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { allowed: false, error: 'demo_not_configured' });
  } finally {
    if (previousHash === undefined) delete process.env.DEMO_ABLE_TOKEN_SHA256;
    else process.env.DEMO_ABLE_TOKEN_SHA256 = previousHash;
    if (previousExpiration === undefined) delete process.env.DEMO_ABLE_EXPIRES_AT;
    else process.env.DEMO_ABLE_EXPIRES_AT = previousExpiration;
  }
});

test('valida token de demonstração configurado sem expor o token no código', () => {
  const token = 'token-de-teste';
  const previousHash = process.env.DEMO_JACOB_TOKEN_SHA256;
  const previousExpiration = process.env.DEMO_JACOB_EXPIRES_AT;
  process.env.DEMO_JACOB_TOKEN_SHA256 = crypto.createHash('sha256').update(token).digest('hex');
  process.env.DEMO_JACOB_EXPIRES_AT = '2099-01-01T00:00:00Z';
  try {
    assert.equal(invoke({ demo: 'jacob', token }).body.allowed, true);
    assert.equal(invoke({ demo: 'jacob', token: 'errado' }).body.allowed, false);
  } finally {
    if (previousHash === undefined) delete process.env.DEMO_JACOB_TOKEN_SHA256;
    else process.env.DEMO_JACOB_TOKEN_SHA256 = previousHash;
    if (previousExpiration === undefined) delete process.env.DEMO_JACOB_EXPIRES_AT;
    else process.env.DEMO_JACOB_EXPIRES_AT = previousExpiration;
  }
});
