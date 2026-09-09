import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutopilotQueue, scoreAutopilotLead } from '../src/autopilotEngine.js';

const NOW = new Date('2030-01-15T12:00:00');

function lead(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Lead teste',
    value: 500,
    status: 'Contatado',
    nextContact: '',
    createdAt: '2030-01-10T12:00:00.000Z',
    updatedAt: '2030-01-10T12:00:00.000Z',
    lastFollowupAt: null,
    ...overrides,
  };
}

test('follow-up atrasado vence oportunidade cara sem urgência real', () => {
  const overdue = lead({ id: 'atrasado', value: 300, nextContact: '2030-01-14', updatedAt: '2030-01-14T12:00:00.000Z' });
  const expensive = lead({ id: 'caro', value: 20000, status: 'Interessado', nextContact: '2030-01-20', updatedAt: '2030-01-15T11:00:00.000Z' });
  const queue = buildAutopilotQueue([expensive, overdue], { now: NOW });
  assert.equal(queue[0].lead.id, 'atrasado');
  assert.ok(queue[0].primaryReason.includes('atrasado'));
});

test('proposta sem próximo contato vira prioridade acionável', () => {
  const item = scoreAutopilotLead(lead({
    status: 'Proposta enviada',
    nextContact: '',
    updatedAt: '2030-01-14T12:00:00.000Z',
  }), NOW);
  assert.equal(item.actionable, true);
  assert.ok(item.reasons.includes('sem próximo contato definido'));
  assert.ok(['high', 'medium'].includes(item.priority));
});

test('vendidos e perdidos nunca entram na fila', () => {
  const queue = buildAutopilotQueue([
    lead({ id: 'vendido', status: 'Vendido', nextContact: '2030-01-10' }),
    lead({ id: 'perdido', status: 'Perdido', nextContact: '2030-01-10' }),
    lead({ id: 'aberto', status: 'Interessado', nextContact: '', updatedAt: '2030-01-12T12:00:00.000Z' }),
  ], { now: NOW });
  assert.deepEqual(queue.map(item => item.lead.id), ['aberto']);
});

test('novo lead sem primeiro contato aparece abaixo de follow-ups urgentes', () => {
  const queue = buildAutopilotQueue([
    lead({ id: 'novo', status: 'Novo lead', nextContact: '', value: 5000, updatedAt: '2030-01-15T10:00:00.000Z', createdAt: '2030-01-15T10:00:00.000Z' }),
    lead({ id: 'hoje', status: 'Contatado', nextContact: '2030-01-15', value: 200, updatedAt: '2030-01-14T12:00:00.000Z' }),
  ], { now: NOW });
  assert.equal(queue[0].lead.id, 'hoje');
  assert.equal(queue[1].lead.id, 'novo');
});

test('valor potencial ajuda a desempatar, mas não domina prazo e etapa', () => {
  const queue = buildAutopilotQueue([
    lead({ id: 'baixo', status: 'Interessado', nextContact: '', value: 500, updatedAt: '2030-01-14T12:00:00.000Z' }),
    lead({ id: 'alto', status: 'Interessado', nextContact: '', value: 5000, updatedAt: '2030-01-14T12:00:00.000Z' }),
  ], { now: NOW });
  assert.equal(queue[0].lead.id, 'alto');
  assert.equal(queue[1].lead.id, 'baixo');
});
