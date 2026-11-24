import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoolingWatchlist,
  getLeadTemperature,
  temperatureDateKey,
  temperatureDayDiff,
  temperatureIdleDays,
} from '../src/leadTemperature.js';
import {
  autopilotMessageSuggestion,
  autopilotRecommendation,
  buildAutopilotQueue,
  dayDiff,
  daysWithoutInteraction,
  scoreAutopilotLead,
} from '../src/autopilotEngine.js';

const NOW = new Date('2030-01-15T12:00:00');

function lead(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Lead teste',
    value: 0,
    status: 'Contatado',
    nextContact: '2030-01-20',
    createdAt: '2030-01-15T10:00:00',
    updatedAt: '2030-01-15T10:00:00',
    lastFollowupAt: null,
    ...overrides,
  };
}

test('diferença de dias: passado, hoje, vazio, lixo e virada de mês', () => {
  for (const fn of [temperatureDayDiff, dayDiff]) {
    assert.equal(fn('2030-01-14', NOW), -1);
    assert.equal(fn('2030-01-15', new Date('2030-01-15T23:59:00')), 0);
    assert.equal(fn('2030-02-01', new Date('2030-01-31T08:00:00')), 1);
    assert.equal(fn('', NOW), null);
    assert.equal(fn(null, NOW), null);
    assert.equal(fn('lixo', NOW), null);
  }
  assert.equal(temperatureDateKey(new Date(2030, 0, 5)), '2030-01-05');
});

test('dias sem interação: prioriza lastFollowupAt e nunca fica negativo', () => {
  for (const fn of [temperatureIdleDays, daysWithoutInteraction]) {
    assert.equal(fn({ lastFollowupAt: '2030-01-14T12:00:00', updatedAt: '2030-01-01T00:00:00' }, NOW), 1);
    assert.equal(fn({ updatedAt: '2030-01-20T00:00:00' }, NOW), 0);
    assert.equal(fn({ createdAt: '2030-01-05T12:00:00' }, NOW), 10);
    assert.equal(fn({}, NOW), 0);
    assert.equal(fn(null, NOW), 0);
    assert.equal(fn({ updatedAt: 'lixo' }, NOW), 0);
  }
});

test('temperatura: novo lead sem data não pede "próximo contato", status desconhecido usa janela de Contatado', () => {
  assert.equal(getLeadTemperature(lead({ status: 'Novo lead', nextContact: '' }), NOW).level, 'hot');
  const unknown = getLeadTemperature(lead({ status: 'Etapa antiga', updatedAt: '2030-01-08T12:00:00' }), NOW);
  assert.equal(unknown.level, 'cooling');
  assert.equal(unknown.days, 7);
});

test('temperatura: sem próximo contato há 1 dia vira atenção; ontem vira "Interação ontem"', () => {
  const noNext = getLeadTemperature(lead({ nextContact: '', updatedAt: '2030-01-14T10:00:00' }), NOW);
  assert.equal(noNext.level, 'attention');
  assert.equal(noNext.reason, 'Sem próximo contato definido');
  const yesterday = getLeadTemperature(lead({ updatedAt: '2030-01-14T10:00:00' }), NOW);
  assert.equal(yesterday.reason, 'Interação ontem');
});

test('temperatura: singular e plural em "dia/dias" no atraso', () => {
  assert.equal(getLeadTemperature(lead({ nextContact: '2030-01-14' }), NOW).reason, 'Follow-up atrasado há 1 dia');
  assert.equal(getLeadTemperature(lead({ nextContact: '2030-01-12' }), NOW).reason, 'Follow-up atrasado há 3 dias');
});

test('watchlist respeita limite, ignora quentes e aceita entrada inválida', () => {
  const cold = Array.from({ length: 10 }, (_, i) => lead({ id: `c${i}`, updatedAt: '2030-01-01T12:00:00' }));
  assert.equal(buildCoolingWatchlist([...cold, lead({ id: 'quente' })], { now: NOW }).length, 6);
  assert.equal(buildCoolingWatchlist(cold, { now: NOW, limit: 2 }).length, 2);
  assert.ok(!buildCoolingWatchlist([lead({ id: 'quente' })], { now: NOW }).length);
  assert.deepEqual(buildCoolingWatchlist(null, { now: NOW }), []);
});

test('autopilot: lead fechado ou nulo tem score zero e não é acionável', () => {
  for (const item of [scoreAutopilotLead(lead({ status: 'Fechado' }), NOW), scoreAutopilotLead(null, NOW)]) {
    assert.equal(item.score, 0);
    assert.equal(item.actionable, false);
    assert.equal(item.urgencyRank, 99);
  }
});

test('autopilot: lead com retorno distante e sem sinal não entra na fila', () => {
  const item = scoreAutopilotLead(lead({ status: 'Novo lead', nextContact: '2030-02-10' }), NOW);
  assert.equal(item.actionable, false);
  assert.deepEqual(buildAutopilotQueue([item.lead], { now: NOW }), []);
});

test('autopilot: atraso pesa no máximo 30 pontos extras', () => {
  const late6 = scoreAutopilotLead(lead({ nextContact: '2030-01-09' }), NOW);
  const late60 = scoreAutopilotLead(lead({ nextContact: '2029-11-16' }), NOW);
  const overdue = item => item.reasonDetails.find(reason => reason.type === 'overdue').weight;
  assert.equal(overdue(late6), 120);
  assert.equal(overdue(late60), 120);
});

test('autopilot: fila ignora nulos, limite inválido volta para 12', () => {
  const leads = Array.from({ length: 20 }, (_, i) => lead({ id: `l${i}`, nextContact: '2030-01-10' }));
  assert.equal(buildAutopilotQueue([null, ...leads], { now: NOW, limit: 'abc' }).length, 12);
  assert.equal(buildAutopilotQueue(leads, { now: NOW, limit: 3 }).length, 3);
  assert.deepEqual(buildAutopilotQueue(undefined, { now: NOW }), []);
});

test('autopilot: recomendação cobre item nulo e cada situação', () => {
  assert.equal(autopilotRecommendation(null).title, 'Revise a negociação');
  const title = overrides => autopilotRecommendation(scoreAutopilotLead(lead(overrides), NOW)).title;
  assert.equal(title({ nextContact: '2030-01-10' }), 'Retome esse contato agora');
  assert.equal(title({ nextContact: '2030-01-15' }), 'Resolva o contato de hoje');
  assert.equal(title({ status: 'Negociação', nextContact: '' }), 'Defina o próximo passo da negociação');
  assert.equal(title({ status: 'Negociação' }), 'Conduza para uma decisão');
  assert.equal(title({ status: 'Proposta enviada', nextContact: '' }), 'Não deixe a proposta sem retorno');
  assert.equal(title({ status: 'Proposta enviada' }), 'Destrave a proposta');
  assert.equal(title({ status: 'Novo lead', nextContact: '' }), 'Faça o primeiro contato');
  assert.equal(title({ nextContact: '' }), 'Defina o próximo passo');
  assert.equal(title({ updatedAt: '2030-01-01T12:00:00' }), 'Reative antes que esfrie de vez');
  assert.equal(title({ updatedAt: '2030-01-10T12:00:00' }), 'Evite que essa negociação esfrie');
  assert.equal(title({}), 'Avance a negociação');
});

test('autopilot: mensagem usa só o primeiro nome, com acento, e trata nome vazio', () => {
  const msg = (overrides, tone) => autopilotMessageSuggestion(scoreAutopilotLead(lead(overrides), NOW), tone);
  assert.match(msg({ name: '  Ângela   Souza ', nextContact: '2030-01-10' }), /^Oi, Ângela!/);
  assert.match(msg({ name: '', nextContact: '2030-01-10' }), /^Oi, tudo bem!/);
  assert.equal(autopilotMessageSuggestion(null), '');
  assert.equal(autopilotMessageSuggestion({}), '');
  assert.match(msg({ status: 'Negociação' }, 'last'), /encerrar meu acompanhamento/);
  assert.match(msg({ status: 'Novo lead' }, 'light'), /Vi seu contato/);
  assert.match(msg({ updatedAt: '2030-01-01T12:00:00' }, 'light'), /Faz um tempinho/);
});
