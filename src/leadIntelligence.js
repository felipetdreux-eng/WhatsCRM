import { temperatureDayDiff, temperatureIdleDays } from './leadTemperature';

const CLOSED = new Set(['Fechado', 'Perdido']);

const STATUS_SCORE = {
  'Novo lead': 16,
  Contatado: 22,
  Interessado: 32,
  'Proposta enviada': 38,
  Negociação: 44,
};

const ORIGIN_SCORE = {
  Site: 14,
  Indicação: 12,
  WhatsApp: 9,
  Instagram: 6,
  'Google Maps': 5,
  Outro: 3,
};

function valueScore(value) {
  const amount = Number(value || 0);
  if (amount >= 50000) return 24;
  if (amount >= 25000) return 20;
  if (amount >= 10000) return 15;
  if (amount >= 5000) return 10;
  if (amount > 0) return 5;
  return 0;
}

function recencyScore(lead, now) {
  const days = temperatureIdleDays(lead, now);
  if (days <= 1) return 12;
  if (days <= 3) return 8;
  if (days <= 7) return 4;
  return 0;
}

function timingScore(lead, now) {
  const due = temperatureDayDiff(lead.nextContact, now);
  if (due != null && due < 0) return 16;
  if (due === 0) return 12;
  if (due === 1) return 7;
  if (!lead.nextContact && lead.status !== 'Novo lead') return 5;
  return 0;
}

function priorityFromScore(score) {
  if (score >= 80) return { level: 'now', label: 'Atacar agora' };
  if (score >= 60) return { level: 'high', label: 'Alta' };
  if (score >= 40) return { level: 'medium', label: 'Média' };
  return { level: 'low', label: 'Baixa' };
}

function recommendedAction(lead, now) {
  const due = temperatureDayDiff(lead.nextContact, now);
  if (due != null && due < 0) return 'Fazer follow-up agora';
  if (lead.status === 'Novo lead' && lead.origin === 'Site') return 'Responder lead do site';
  if (lead.status === 'Novo lead') return 'Fazer primeiro contato';
  if (lead.status === 'Interessado') return 'Avançar para proposta';
  if (lead.status === 'Proposta enviada') return 'Cobrar retorno da proposta';
  if (lead.status === 'Negociação') return 'Retomar negociação';
  if (!lead.nextContact) return 'Agendar próximo contato';
  return lead.nextAction || 'Retomar contato';
}

export function getLeadIntelligence(lead, now = new Date()) {
  if (!lead || CLOSED.has(lead.status)) return null;

  const reasons = [];
  let score = 0;

  const stage = STATUS_SCORE[lead.status] || 8;
  score += stage;
  if (lead.status === 'Negociação') reasons.push('Negociação avançada');
  else if (lead.status === 'Proposta enviada') reasons.push('Proposta em aberto');
  else if (lead.status === 'Interessado') reasons.push('Lead demonstrou interesse');

  const amount = Number(lead.value || 0);
  const amountPoints = valueScore(amount);
  score += amountPoints;
  if (amount >= 50000) reasons.push('Valor potencial muito alto');
  else if (amount >= 25000) reasons.push('Valor potencial alto');
  else if (amount >= 10000) reasons.push('Bom valor potencial');

  const originPoints = ORIGIN_SCORE[lead.origin] ?? 3;
  score += originPoints;
  if (lead.origin === 'Site') reasons.push('Chegou pelo site');
  else if (lead.origin === 'Indicação') reasons.push('Veio por indicação');

  const idleDays = temperatureIdleDays(lead, now);
  score += recencyScore(lead, now);
  if (idleDays <= 1) reasons.push('Interação muito recente');

  const due = temperatureDayDiff(lead.nextContact, now);
  score += timingScore(lead, now);
  if (due != null && due < 0) reasons.push(`Follow-up atrasado ${Math.abs(due)}d`);
  else if (due === 0) reasons.push('Follow-up para hoje');
  else if (!lead.nextContact && lead.status !== 'Novo lead') reasons.push('Sem próximo contato');

  if (lead.phone) score += 4;
  if (lead.company) score += 3;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const priority = priorityFromScore(score);

  return {
    score,
    ...priority,
    reasons: reasons.slice(0, 3),
    reason: reasons[0] || 'Oportunidade ativa',
    recommendedAction: recommendedAction(lead, now),
  };
}

export function buildSmartLeadList(leads, { now = new Date(), limit = Infinity, minScore = 0 } = {}) {
  return (Array.isArray(leads) ? leads : [])
    .map(lead => ({ lead, intelligence: getLeadIntelligence(lead, now) }))
    .filter(item => item.intelligence && item.intelligence.score >= minScore)
    .sort((a, b) => {
      if (a.intelligence.score !== b.intelligence.score) return b.intelligence.score - a.intelligence.score;
      return Number(b.lead.value || 0) - Number(a.lead.value || 0);
    })
    .slice(0, Number.isFinite(limit) ? Math.max(1, limit) : undefined);
}
