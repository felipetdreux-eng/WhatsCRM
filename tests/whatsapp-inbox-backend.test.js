import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { chainHas, createFakeSupabase } from './helpers/fakes.js';
import { supabase } from '../src/supabaseClient.js';
import {
  loadLeadWhatsAppMessages,
  loadWhatsAppConnectionStatus,
  mapWhatsAppMessage,
  subscribeToLeadWhatsAppMessages,
} from '../src/whatsappInboxBackend.js';

let fake;
afterEach(() => fake?.restore());

test('mapWhatsAppMessage: direção, mídia sem texto e data inválida', () => {
  const outbound = mapWhatsAppMessage({ id: '1', direction: 'outbound', body: 'Oi', occurred_at: '2030-01-15T12:00:00Z' });
  assert.equal(outbound.side, 'outbound');
  assert.equal(outbound.text, 'Oi');
  assert.match(outbound.time, /^\d{2}:\d{2}$/);

  const media = mapWhatsAppMessage({ id: '2', direction: 'inbound', body: '', has_media: true, media_filename: 'foto.jpg', occurred_at: 'lixo' });
  assert.equal(media.side, 'inbound');
  assert.equal(media.text, '[Arquivo]');
  assert.equal(media.meta, 'foto.jpg');
  assert.equal(media.time, '');

  const unknown = mapWhatsAppMessage({ id: '3', direction: 'qualquer', body: null });
  assert.equal(unknown.side, 'inbound');
  assert.equal(unknown.text, '');
  assert.equal(unknown.meta, '');
});

test('status da conexão: sem sessão devolve null sem consultar integrações', async () => {
  fake = createFakeSupabase(supabase, { user: null });
  assert.equal(await loadWhatsAppConnectionStatus(), null);
  assert.ok(!fake.calls.some(call => call.table === 'whatsapp_integrations'));
});

test('status da conexão filtra pela equipe ativa e não pede o hash do token', async () => {
  fake = createFakeSupabase(supabase, {
    user: { id: 'u1' },
    tables: {
      profiles: { data: { active_workspace_id: 'ws-1' }, error: null },
      whatsapp_integrations: { data: { workspace_id: 'ws-1', enabled: true }, error: null },
    },
  });
  const status = await loadWhatsAppConnectionStatus();
  assert.equal(status.workspace_id, 'ws-1');
  const call = fake.calls.find(item => item.table === 'whatsapp_integrations');
  assert.ok(chainHas(call.chain, 'eq', 'workspace_id', 'ws-1'));
  const selected = call.chain.find(([name]) => name === 'select')[1];
  assert.ok(!selected.includes('webhook_token_hash'));
});

test('status da conexão propaga erro do perfil', async () => {
  fake = createFakeSupabase(supabase, {
    user: { id: 'u1' },
    tables: { profiles: { data: null, error: new Error('perfil') } },
  });
  await assert.rejects(loadWhatsAppConnectionStatus(), /perfil/);
});

test('mensagens do lead: sem id devolve [] e com id filtra e ordena', async () => {
  fake = createFakeSupabase(supabase, {
    tables: { whatsapp_messages: { data: [{ id: 'm1', direction: 'inbound', body: 'Olá' }], error: null } },
  });
  assert.deepEqual(await loadLeadWhatsAppMessages(''), []);
  const messages = await loadLeadWhatsAppMessages('lead-1', 10);
  assert.equal(messages[0].text, 'Olá');
  const call = fake.calls.find(item => item.table === 'whatsapp_messages');
  assert.ok(chainHas(call.chain, 'eq', 'lead_id', 'lead-1'));
  assert.ok(chainHas(call.chain, 'order', 'occurred_at', { ascending: true }));
  assert.ok(chainHas(call.chain, 'limit', 10));
});

test('subscribe sem lead ou callback devolve função vazia', () => {
  assert.equal(typeof subscribeToLeadWhatsAppMessages('', () => {}), 'function');
  assert.equal(typeof subscribeToLeadWhatsAppMessages('lead-1', null), 'function');
});

test('subscribe escuta INSERT filtrado pelo lead e remove o canal ao sair', () => {
  const originalChannel = supabase.channel;
  const originalRemove = supabase.removeChannel;
  let config;
  let handler;
  let removed = null;
  const channel = {
    on(_event, filter, callback) { config = filter; handler = callback; return channel; },
    subscribe() { return channel; },
  };
  supabase.channel = () => channel;
  supabase.removeChannel = value => { removed = value; };
  try {
    const received = [];
    const unsubscribe = subscribeToLeadWhatsAppMessages('lead-1', message => received.push(message));
    assert.equal(config.filter, 'lead_id=eq.lead-1');
    assert.equal(config.event, 'INSERT');
    handler({ new: { id: 'm1', direction: 'outbound', body: 'Oi' } });
    assert.equal(received[0].side, 'outbound');
    unsubscribe();
    assert.equal(removed, channel);
  } finally {
    supabase.channel = originalChannel;
    supabase.removeChannel = originalRemove;
  }
});
