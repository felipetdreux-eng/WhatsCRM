import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { chainHas, createFakeSupabase, installLocalStorage } from './helpers/fakes.js';
import { supabase } from '../src/supabaseClient.js';
import {
  applyAppTheme,
  createWorkspaceInvite,
  joinWorkspaceByCode,
  loadLeadActivities,
  loadLeads,
  loadWorkspaceContext,
  mirrorAccount,
  recordLeadActivity,
  removeWorkspaceMember,
  renameWorkspace,
  setActiveWorkspace,
  syncLeads,
  syncMessages,
  updateProfileName,
} from '../src/backendBridge.js';

const UUID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
let fake;
let storage;
let seq = 0;
// workspaceCache é global no módulo: cada teste usa um userId novo.
const newUser = () => `user-${++seq}`;

function installDocument() {
  const meta = { content: '', setAttribute(name, value) { this[name] = value; } };
  globalThis.document = { documentElement: { dataset: {} }, querySelector: () => meta };
  return meta;
}

beforeEach(() => {
  storage = installLocalStorage();
  installDocument();
});
afterEach(() => fake?.restore());

function upsertRows(calls, table = 'leads') {
  const call = calls.find(item => item.table === table && chainHas(item.chain, 'select'));
  return call.chain.find(([name]) => name === 'upsert')[1];
}

function fakeWithWorkspace(extra = {}) {
  return createFakeSupabase(supabase, {
    tables: {
      profiles: { data: { active_workspace_id: 'ws-1' }, error: null },
      leads: chain => ({ data: chainHas(chain, 'upsert') ? chain.find(([n]) => n === 'upsert')[1] : [], error: null }),
      ...extra,
    },
  });
}

test('applyAppTheme só aceita dark/light e persiste a escolha', () => {
  const meta = installDocument();
  assert.equal(applyAppTheme('dark'), 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(meta.content, '#101318');
  assert.equal(applyAppTheme('<script>'), 'light');
  assert.equal(storage.getItem('zapflow-theme'), 'light');
});

test('syncLeads grava na equipe ativa, limpa o telefone e converte campos', async () => {
  const userId = newUser();
  fake = fakeWithWorkspace();
  await syncLeads([{
    id: UUID, name: '  ', phone: '(21) 99999-0000', value: '350', status: 'Contatado',
    nextContact: '', nextContactTime: '', createdAt: '2030-01-01T00:00:00.000Z',
  }], userId);
  const [row] = upsertRows(fake.calls);
  assert.equal(row.id, UUID);
  assert.equal(row.workspace_id, 'ws-1');
  assert.equal(row.user_id, userId);
  assert.equal(row.assigned_to, userId);
  assert.equal(row.name, 'Lead sem nome');
  assert.equal(row.phone, '21999990000');
  assert.equal(row.value, 350);
  assert.equal(row.next_contact, null);
  assert.equal(row.next_contact_time, null);
  assert.equal(row.sale_value, null);
  assert.equal(row.sale_value_source, null);
});

test('syncLeads mantém o mesmo UUID para id local não-UUID entre chamadas', async () => {
  const userId = newUser();
  fake = fakeWithWorkspace();
  await syncLeads([{ id: '1', name: 'Ana', phone: '21999990000' }], userId);
  await syncLeads([{ id: '1', name: 'Ana', phone: '21999990000' }], userId);
  const ids = fake.calls.filter(call => call.table === 'leads').map(call => call.chain.find(([n]) => n === 'upsert')[1][0].id);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.match(ids[0], /^[0-9a-f-]{36}$/);
});

test('syncLeads de lead fechado envia valor da venda', async () => {
  const userId = newUser();
  fake = fakeWithWorkspace();
  await syncLeads([{ id: UUID, name: 'Ana', phone: '21999990000', status: 'Fechado', value: 500, saleValue: 450 }], userId);
  const [row] = upsertRows(fake.calls);
  assert.equal(row.sale_value, 450);
  assert.equal(row.sale_value_source, 'confirmed');
});

// Possível bug (não corrigido): lead "Fechado" sem valor de venda é descartado
// em silêncio pelo filtro de syncLeads (nem erro, nem aviso). A constraint do
// banco exige sale_value, então enviar falharia; mas hoje o usuário acha que
// salvou e o lead nunca chega ao Supabase.
test('lead fechado sem valor não é enviado (comportamento atual)', async () => {
  const userId = newUser();
  fake = fakeWithWorkspace();
  const result = await syncLeads([{ id: UUID, name: 'Ana', phone: '21999990000', status: 'Fechado', value: 0 }], userId);
  assert.deepEqual(result, []);
  assert.ok(!fake.calls.some(call => call.table === 'leads'));
});

test('syncLeads sem usuário, sem lista ou sem equipe não chama o banco', async () => {
  fake = createFakeSupabase(supabase, { tables: { profiles: { data: { active_workspace_id: null }, error: null } } });
  assert.deepEqual(await syncLeads(null, 'u'), []);
  assert.deepEqual(await syncLeads([], ''), []);
  assert.deepEqual(await syncLeads([{ id: UUID }], newUser()), []);
  assert.ok(!fake.calls.some(call => call.table === 'leads'));
});

test('loadLeads filtra pela equipe e converte linha do banco', async () => {
  const userId = newUser();
  fake = createFakeSupabase(supabase, {
    tables: {
      profiles: { data: { active_workspace_id: 'ws-9' }, error: null },
      leads: {
        data: [{ id: UUID, name: 'Ana', phone: '21999990000', value: '12.50', sale_value: null, status: 'Contatado', next_contact_time: '14:30:00', next_contact: null }],
        error: null,
      },
    },
  });
  const [lead] = await loadLeads(userId);
  assert.equal(lead.value, 12.5);
  assert.equal(lead.saleValue, null);
  assert.equal(lead.nextContactTime, '14:30');
  assert.equal(lead.nextContact, '');
  const call = fake.calls.find(item => item.table === 'leads');
  assert.ok(chainHas(call.chain, 'eq', 'workspace_id', 'ws-9'));
});

test('loadLeads propaga erro do perfil', async () => {
  fake = createFakeSupabase(supabase, { tables: { profiles: { data: null, error: new Error('sem perfil') } } });
  await assert.rejects(loadLeads(newUser()), /sem perfil/);
});

test('atividades: lead sem UUID não consulta, limite é travado entre 1 e 100', async () => {
  fake = createFakeSupabase(supabase, { tables: { lead_activities: { data: [{ id: 'a', lead_id: UUID, metadata: 'texto' }], error: null } } });
  assert.deepEqual(await loadLeadActivities('u', 'lead-local'), []);
  const [activity] = await loadLeadActivities('u', UUID, 5000);
  assert.deepEqual(activity.metadata, {});
  assert.ok(chainHas(fake.calls[0].chain, 'limit', 100));
});

test('recordLeadActivity valida entrada e limpa espaços', async () => {
  fake = createFakeSupabase(supabase, { tables: { lead_activities: chain => ({ data: chain.find(([n]) => n === 'insert')[1], error: null }) } });
  assert.equal(await recordLeadActivity({ userId: 'u', leadId: 'nao-uuid', kind: 'x', title: 't' }), null);
  assert.equal(await recordLeadActivity({ userId: 'u', leadId: UUID, kind: 'x', title: '' }), null);
  const saved = await recordLeadActivity({ userId: 'u', leadId: UUID, kind: 'lead_updated', title: '  Editou  ', detail: null, metadata: 'x' });
  assert.equal(saved.title, 'Editou');
  assert.equal(saved.detail, '');
  assert.deepEqual(saved.metadata, {});
});

test('syncMessages ignora modelos sem texto', async () => {
  fake = createFakeSupabase(supabase, { tables: { message_templates: { data: [], error: null } } });
  assert.deepEqual(await syncMessages([{ id: 'a', text: '   ' }], 'u'), []);
  assert.equal(fake.calls.length, 0);
  await syncMessages([{ id: 'a', text: 'Oi' }, { title: 'Sem id', text: 'Olá' }], 'u');
  const rows = upsertRows(fake.calls, 'message_templates');
  assert.deepEqual(rows.map(row => row.template_key), ['a', 'Sem id']);
});

test('validações de entrada das ações de equipe acontecem antes do banco', async () => {
  fake = createFakeSupabase(supabase, {});
  await assert.rejects(updateProfileName('u', ' a '), /Nome inválido/);
  await assert.rejects(createWorkspaceInvite(''), /Equipe inválida/);
  await assert.rejects(joinWorkspaceByCode('u', 'abc'), /Código de convite inválido/);
  await assert.rejects(setActiveWorkspace('u', ''), /Equipe inválida/);
  await assert.rejects(renameWorkspace('ws', 'x'), /Nome de equipe inválido/);
  await assert.rejects(removeWorkspaceMember('ws', ''), /Membro inválido/);
  assert.equal(fake.calls.length, 0);
});

test('convite é normalizado para maiúsculas e remover membro exige confirmação true', async () => {
  fake = createFakeSupabase(supabase, { rpc: { join_workspace_by_code: { data: 'ws-2', error: null }, remove_workspace_member: { data: false, error: null } } });
  assert.equal(await joinWorkspaceByCode('u', '  abc123 '), 'ws-2');
  assert.deepEqual(fake.calls[0].args, { _code: 'ABC123' });
  await assert.rejects(removeWorkspaceMember('ws', 'm'), /não foi removida/);
});

test('loadWorkspaceContext cai na primeira equipe quando a ativa não é mais do usuário', async () => {
  const userId = newUser();
  fake = createFakeSupabase(supabase, {
    tables: {
      profiles: chain => (chainHas(chain, 'in')
        ? { data: [{ id: userId, name: 'Ana' }], error: null }
        : { data: { id: userId, active_workspace_id: 'ws-removida' }, error: null }),
      workspace_members: chain => (chainHas(chain, 'eq', 'user_id', userId)
        ? { data: [{ workspace_id: 'ws-1', user_id: userId, role: 'member' }], error: null }
        : { data: [{ workspace_id: 'ws-1', user_id: userId, role: 'member' }, { workspace_id: 'ws-1', user_id: 'outro', role: 'owner' }], error: null }),
      workspaces: { data: [{ id: 'ws-1', name: 'Equipe' }], error: null },
    },
  });
  const context = await loadWorkspaceContext(userId);
  assert.equal(context.activeWorkspace.id, 'ws-1');
  assert.equal(context.myRole, 'member');
  assert.deepEqual(context.members.map(member => member.name), ['Ana', 'Membro']);
});

test('mirrorAccount grava sessão e conta sem duplicar', () => {
  const user = { id: 'u-mirror', email: 'pessoa@exemplo.com' };
  mirrorAccount(user, { name: 'Pessoa', theme: 'dark', active_workspace_id: 'ws-1' });
  mirrorAccount(user, { name: 'Pessoa 2' });
  const accounts = JSON.parse(storage.getItem('zapflow-accounts'));
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].name, 'Pessoa 2');
  assert.equal(JSON.parse(storage.getItem('zapflow-session')).accountId, 'u-mirror');
  assert.equal(storage.getItem('zapflow-storage-owner'), 'u-mirror');
});
