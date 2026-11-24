import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSmartLeadList, getLeadIntelligence } from '../src/leadIntelligence.js';

const NOW = new Date('2030-01-15T12:00:00');

function lead(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Lead teste',
    value: 0,
    status: 'Contatado',
    origin: 'Outro',
    nextContact: '2030-01-20',
    createdAt: '2030-01-15T10:00:00',
    updatedAt: '2030-01-15T10:00:00',
    lastFollowupAt: null,
    ...overrides,
  };
}

test('vendidos, perdidos e vazio não recebem inteligência', () => {
  assert.equal(getLeadIntelligence(lead({ status: 'Fechado' }), NOW), null);
  assert.equal(getLeadIntelligence(lead({ status: 'Perdido' }), NOW), null);
  assert.equal(getLeadIntelligence(null, NOW), null);
});

test('negociação cara, do site e atrasada vira "Atacar agora" com score limitado a 100', () => {
  const result = getLeadIntelligence(lead({
    status: 'Negociação', value: 60000, origin: 'Site', nextContact: '2030-01-10', phone: '21999999999', company: 'ACME',
  }), NOW);
  assert.equal(result.score, 100);
  assert.equal(result.level, 'now');
  assert.equal(result.recommendedAction, 'Fazer follow-up agora');
  assert.equal(result.reasons.length, 3);
  assert.equal(result.reason, 'Negociação avançada');
});

test('novo lead do site pede resposta ao site, sem "sem próximo contato"', () => {
  const result = getLeadIntelligence(lead({ status: 'Novo lead', origin: 'Site', nextContact: '' }), NOW);
  assert.equal(result.recommendedAction, 'Responder lead do site');
  assert.ok(!result.reasons.includes('Sem próximo contato'));
});

test('ação recomendada por etapa', () => {
  const action = overrides => getLeadIntelligence(lead(overrides), NOW).recommendedAction;
  assert.equal(action({ status: 'Novo lead' }), 'Fazer primeiro contato');
  assert.equal(action({ status: 'Interessado' }), 'Avançar para proposta');
  assert.equal(action({ status: 'Proposta enviada' }), 'Cobrar retorno da proposta');
  assert.equal(action({ status: 'Negociação' }), 'Retomar negociação');
  assert.equal(action({ status: 'Contatado', nextContact: '' }), 'Agendar próximo contato');
  assert.equal(action({ status: 'Contatado', nextAction: 'Ligar' }), 'Ligar');
  assert.equal(action({ status: 'Contatado' }), 'Retomar contato');
});

test('follow-up de hoje e atrasado aparecem nos motivos', () => {
  assert.ok(getLeadIntelligence(lead({ nextContact: '2030-01-15' }), NOW).reasons.includes('Follow-up para hoje'));
  assert.ok(getLeadIntelligence(lead({ nextContact: '2030-01-12' }), NOW).reasons.includes('Follow-up atrasado 3d'));
});

test('status, origem e datas desconhecidas não quebram o cálculo', () => {
  const result = getLeadIntelligence(lead({ status: 'Etapa antiga', origin: '???', value: 'abc', updatedAt: 'lixo', createdAt: 'lixo', nextContact: 'lixo' }), NOW);
  assert.equal(typeof result.score, 'number');
  assert.ok(Number.isFinite(result.score));
  assert.equal(result.level, 'low');
});

test('lista inteligente ordena por score e desempata pelo valor', () => {
  const items = buildSmartLeadList([
    lead({ id: 'baixo', value: 100 }),
    lead({ id: 'alto', value: 200 }),
    lead({ id: 'negociacao', status: 'Negociação' }),
    lead({ id: 'perdido', status: 'Perdido' }),
  ], { now: NOW });
  assert.deepEqual(items.map(item => item.lead.id), ['negociacao', 'alto', 'baixo']);
});

test('lista inteligente respeita limite e score mínimo, e aceita entrada inválida', () => {
  const leads = [lead({ id: 'a', status: 'Negociação' }), lead({ id: 'b' }), lead({ id: 'c' })];
  assert.equal(buildSmartLeadList(leads, { now: NOW, limit: 2 }).length, 2);
  assert.deepEqual(buildSmartLeadList(leads, { now: NOW, minScore: 50 }).map(item => item.lead.id), ['a']);
  assert.deepEqual(buildSmartLeadList(null), []);
});
