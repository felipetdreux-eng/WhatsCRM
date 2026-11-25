import test from 'node:test';
import assert from 'node:assert/strict';
import { autopilotMessageSuggestion, buildAutopilotQueue, scoreAutopilotLead } from '../src/autopilotEngine.js';

const NOW = new Date('2030-01-15T12:00:00');

function lead(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Lead teste',
    value: 500,
    status: 'Em conversa',
    nextContact: '',
    createdAt: '2030-01-10T12:00:00.000Z',
    updatedAt: '2030-01-10T12:00:00.000Z',
    lastFollowupAt: null,
    ...overrides,
  };
}

test('follow-up atrasado vence oportunidade cara sem urgência real', () => {
  const overdue = lead({ id: 'atrasado', value: 300, nextContact: '2030-01-14', updatedAt: '2030-01-14T12:00:00.000Z' });
  const expensive = lead({ id: 'caro', value: 20000, status: 'Cardápio enviado', nextContact: '2030-01-20', updatedAt: '2030-01-15T11:00:00.000Z' });
  const queue = buildAutopilotQueue([expensive, overdue], { now: NOW });
  assert.equal(queue[0].lead.id, 'atrasado');
  assert.ok(queue[0].primaryReason.includes('atrasado'));
});

test('proposta sem próximo contato vira prioridade acionável', () => {
  const item = scoreAutopilotLead(lead({
    status: 'Orçamento enviado',
    nextContact: '',
    updatedAt: '2030-01-14T12:00:00.000Z',
  }), NOW);
  assert.equal(item.actionable, true);
  assert.ok(item.reasons.includes('sem próximo contato definido'));
  assert.ok(['high', 'medium'].includes(item.priority));
});

test('vendidos e perdidos nunca entram na fila', () => {
  const queue = buildAutopilotQueue([
    lead({ id: 'vendido', status: 'Confirmado', nextContact: '2030-01-10' }),
    lead({ id: 'perdido', status: 'Perdido', nextContact: '2030-01-10' }),
    lead({ id: 'aberto', status: 'Cardápio enviado', nextContact: '', updatedAt: '2030-01-12T12:00:00.000Z' }),
  ], { now: NOW });
  assert.deepEqual(queue.map(item => item.lead.id), ['aberto']);
});

test('novo lead sem primeiro contato aparece abaixo de follow-ups urgentes', () => {
  const queue = buildAutopilotQueue([
    lead({ id: 'novo', status: 'Novo pedido', nextContact: '', value: 5000, updatedAt: '2030-01-15T10:00:00.000Z', createdAt: '2030-01-15T10:00:00.000Z' }),
    lead({ id: 'hoje', status: 'Em conversa', nextContact: '2030-01-15', value: 200, updatedAt: '2030-01-14T12:00:00.000Z' }),
  ], { now: NOW });
  assert.equal(queue[0].lead.id, 'hoje');
  assert.equal(queue[1].lead.id, 'novo');
});

test('valor potencial ajuda a desempatar, mas não domina prazo e etapa', () => {
  const queue = buildAutopilotQueue([
    lead({ id: 'baixo', status: 'Cardápio enviado', nextContact: '', value: 500, updatedAt: '2030-01-14T12:00:00.000Z' }),
    lead({ id: 'alto', status: 'Cardápio enviado', nextContact: '', value: 5000, updatedAt: '2030-01-14T12:00:00.000Z' }),
  ], { now: NOW });
  assert.equal(queue[0].lead.id, 'alto');
  assert.equal(queue[1].lead.id, 'baixo');
});


test('autopilot 2.0 gera mensagem contextual para proposta', () => {
  const item = scoreAutopilotLead(lead({
    name: 'Adriano Cardoso',
    status: 'Orçamento enviado',
    nextContact: '2030-01-14',
    updatedAt: '2030-01-13T12:00:00.000Z',
  }), NOW);
  const message = autopilotMessageSuggestion(item, 'direct');
  assert.match(message, /Adriano/);
  assert.match(message.toLowerCase(), /proposta/);
});

test('autopilot 2.0 oferece abordagem leve e última tentativa diferentes', () => {
  const item = scoreAutopilotLead(lead({
    name: 'Marina Lopes',
    status: 'Em conversa',
    nextContact: '',
    updatedAt: '2030-01-05T12:00:00.000Z',
  }), NOW);
  const light = autopilotMessageSuggestion(item, 'light');
  const last = autopilotMessageSuggestion(item, 'last');
  assert.notEqual(light, last);
  assert.match(light, /Marina/);
  assert.match(last.toLowerCase(), /última|organizar/);
});
