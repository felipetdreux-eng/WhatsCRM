import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoolingWatchlist, getLeadTemperature } from '../src/leadTemperature.js';

const NOW = new Date('2030-01-15T12:00:00');

function lead(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Lead teste',
    value: 500,
    status: 'Contatado',
    nextContact: '2030-01-20',
    createdAt: '2030-01-10T12:00:00.000Z',
    updatedAt: '2030-01-15T09:00:00.000Z',
    lastFollowupAt: null,
    ...overrides,
  };
}

test('follow-up atrasado é classificado como esfriando', () => {
  const temperature = getLeadTemperature(lead({ nextContact: '2030-01-14' }), NOW);
  assert.equal(temperature.level, 'cooling');
  assert.match(temperature.reason, /atrasado/);
});

test('proposta sem próximo contato esfria mais rápido', () => {
  const temperature = getLeadTemperature(lead({
    status: 'Proposta enviada',
    nextContact: '',
    updatedAt: '2030-01-12T12:00:00.000Z',
  }), NOW);
  assert.equal(temperature.level, 'cooling');
  assert.match(temperature.reason, /Proposta parada/);
});

test('interação recente mantém negociação quente', () => {
  const temperature = getLeadTemperature(lead({ updatedAt: '2030-01-15T09:00:00.000Z' }), NOW);
  assert.equal(temperature.level, 'hot');
  assert.equal(temperature.atRisk, false);
});

test('watchlist prioriza esfriando antes de atenção e proposta antes de etapas iniciais', () => {
  const items = buildCoolingWatchlist([
    lead({ id: 'atencao', status: 'Contatado', updatedAt: '2030-01-11T12:00:00.000Z' }),
    lead({ id: 'proposta', status: 'Proposta enviada', nextContact: '', updatedAt: '2030-01-12T12:00:00.000Z' }),
    lead({ id: 'frio', status: 'Interessado', updatedAt: '2030-01-08T12:00:00.000Z' }),
  ], { now: NOW });
  assert.deepEqual(items.map(item => item.lead.id), ['proposta', 'frio', 'atencao']);
});

test('vendidos e perdidos não recebem temperatura operacional', () => {
  assert.equal(getLeadTemperature(lead({ status: 'Vendido' }), NOW), null);
  assert.equal(getLeadTemperature(lead({ status: 'Perdido' }), NOW), null);
});
