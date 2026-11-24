import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { chainHas, createFakeSupabase, installLocalStorage } from './helpers/fakes.js';
import { supabase } from '../src/supabaseClient.js';
import {
  automationKindLabel,
  automationStatusLabel,
  cancelAutomationItem,
  loadAutomationDashboard,
  recordLeadResponseForAutomation,
  runAutomationsNow,
  saveAutomationSettings,
} from '../src/automationBackend.js';

const USER = { id: 'user-1' };
const WORKSPACE = { id: 'ws-1', name: 'Equipe Ana', owner_id: 'user-1' };

let fake;
let storage;
beforeEach(() => { storage = installLocalStorage(); });
afterEach(() => fake?.restore());

function withWorkspace(overrides = {}) {
  return createFakeSupabase(supabase, {
    user: USER,
    tables: {
      profiles: { data: { active_workspace_id: 'ws-1' }, error: null },
      workspaces: { data: WORKSPACE, error: null },
      workspace_automation_settings: chain => (chainHas(chain, 'upsert')
        ? { data: chain.find(([name]) => name === 'upsert')[1], error: null }
        : { data: { workspace_id: 'ws-1', first_contact_delay_minutes: '10', followup_delay_hours: null }, error: null }),
      automation_outbox: { data: [{ id: 'o1' }], error: null },
      ...overrides.tables,
    },
    rpc: overrides.rpc,
  });
}

test('sem sessão: painel em modo demonstração com configurações salvas localmente', async () => {
  fake = createFakeSupabase(supabase, { user: null });
  storage.setItem('fuply-automation-settings-demo', JSON.stringify({ followup_delay_hours: 48 }));
  const dashboard = await loadAutomationDashboard();
  assert.equal(dashboard.demo, true);
  assert.equal(dashboard.settings.followup_delay_hours, 48);
  assert.equal(dashboard.settings.max_followup_attempts, 3);
  assert.deepEqual(dashboard.outbox, []);
});

test('sem sessão e JSON de demo corrompido: volta para os padrões', async () => {
  fake = createFakeSupabase(supabase, { user: null });
  storage.setItem('fuply-automation-settings-demo', '{quebrado');
  const dashboard = await loadAutomationDashboard();
  assert.equal(dashboard.settings.followup_delay_hours, 24);
});

test('com sessão: filtra settings e outbox pela equipe ativa e converte números', async () => {
  fake = withWorkspace();
  const dashboard = await loadAutomationDashboard();
  assert.equal(dashboard.demo, false);
  assert.equal(dashboard.workspaceName, 'Equipe Ana');
  assert.equal(dashboard.canConfigure, true);
  assert.equal(dashboard.settings.first_contact_delay_minutes, 10);
  assert.equal(dashboard.settings.followup_delay_hours, 24);
  const outboxCall = fake.calls.find(call => call.table === 'automation_outbox');
  assert.ok(chainHas(outboxCall.chain, 'eq', 'workspace_id', 'ws-1'));
  const settingsCall = fake.calls.find(call => call.table === 'workspace_automation_settings');
  assert.ok(chainHas(settingsCall.chain, 'eq', 'workspace_id', 'ws-1'));
});

test('erro do banco ao carregar o painel é propagado', async () => {
  fake = withWorkspace({ tables: { automation_outbox: { data: null, error: new Error('rls') } } });
  await assert.rejects(loadAutomationDashboard(), /rls/);
});

test('salvar limita os valores aos mesmos intervalos do banco', async () => {
  fake = withWorkspace();
  const saved = await saveAutomationSettings({
    enabled: 'sim',
    first_contact_delay_minutes: 99999,
    followup_delay_hours: 0,
    max_followup_attempts: -5,
  });
  assert.equal(saved.workspace_id, 'ws-1');
  assert.equal(saved.enabled, true);
  assert.equal(saved.first_contact_delay_minutes, 1440);
  assert.equal(saved.followup_delay_hours, 24);
  assert.equal(saved.max_followup_attempts, 1);
});

test('salvar com texto inválido usa padrões seguros', async () => {
  fake = withWorkspace();
  const saved = await saveAutomationSettings({ first_contact_delay_minutes: 'abc', followup_delay_hours: 'x', max_followup_attempts: 'y' });
  assert.equal(saved.first_contact_delay_minutes, 0);
  assert.equal(saved.followup_delay_hours, 24);
  assert.equal(saved.max_followup_attempts, 3);
});

test('membro que não é dono não pode salvar automações', async () => {
  fake = withWorkspace({ tables: { workspaces: { data: { ...WORKSPACE, owner_id: 'outra-pessoa' }, error: null } } });
  await assert.rejects(saveAutomationSettings({}), /Somente o dono/);
  assert.ok(!fake.calls.some(call => call.table === 'workspace_automation_settings'));
});

test('sem sessão, salvar grava só no localStorage', async () => {
  fake = createFakeSupabase(supabase, { user: null });
  await saveAutomationSettings({ followup_delay_hours: 12 });
  assert.equal(JSON.parse(storage.getItem('fuply-automation-settings-demo')).followup_delay_hours, 12);
});

// Possível bug (não corrigido): no modo demo os valores não passam pelo mesmo
// limite (0-1440 min, 1-720 h, 1-10 tentativas) aplicado ao salvar no banco.
test.todo('modo demo deveria limitar valores como no salvamento real');

test('rodar automações chama a RPC da equipe ativa; sem sessão devolve 0', async () => {
  fake = withWorkspace({ rpc: { run_automations_now: { data: '3', error: null } } });
  assert.equal(await runAutomationsNow(), 3);
  assert.deepEqual(fake.calls.find(call => call.rpc).args, { _workspace_id: 'ws-1' });
  fake.restore();
  fake = createFakeSupabase(supabase, { user: null });
  assert.equal(await runAutomationsNow(), 0);
});

test('cancelar só mexe em itens pendentes/prontos; id vazio não chama o banco', async () => {
  fake = withWorkspace();
  await cancelAutomationItem('');
  assert.equal(fake.calls.length, 0);
  await cancelAutomationItem('o1');
  const call = fake.calls.find(item => item.table === 'automation_outbox');
  assert.ok(chainHas(call.chain, 'update', { status: 'cancelled', cancel_reason: 'manual_cancel' }));
  assert.ok(chainHas(call.chain, 'eq', 'id', 'o1'));
  assert.ok(chainHas(call.chain, 'in', 'status', ['pending', 'ready']));
});

test('registrar resposta do lead converte o retorno para booleano e propaga erro', async () => {
  fake = withWorkspace({ rpc: { record_lead_response: { data: 1, error: null } } });
  assert.equal(await recordLeadResponseForAutomation(''), false);
  assert.equal(await recordLeadResponseForAutomation('lead-1'), true);
  fake.restore();
  fake = withWorkspace({ rpc: { record_lead_response: { data: null, error: new Error('negado') } } });
  await assert.rejects(recordLeadResponseForAutomation('lead-1'), /negado/);
});

test('rótulos desconhecidos têm fallback', () => {
  assert.equal(automationStatusLabel('???'), 'Cancelada');
  assert.equal(automationKindLabel(undefined), 'Follow-up');
});
