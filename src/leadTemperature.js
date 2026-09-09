if (typeof document !== 'undefined') import('./cooling.css');

const CLOSED = new Set(['Vendido', 'Perdido']);

const WINDOWS = {
  'Proposta enviada': { attention: 2, cooling: 4 },
  Interessado: { attention: 3, cooling: 6 },
  Contatado: { attention: 4, cooling: 7 },
  'Novo lead': { attention: 2, cooling: 4 },
};

export function temperatureDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function temperatureDayDiff(value, now = new Date()) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${temperatureDateKey(now)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
}

export function temperatureIdleDays(lead, now = new Date()) {
  const source = lead?.lastFollowupAt || lead?.updatedAt || lead?.createdAt;
  if (!source) return 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function result(level, days, reason, detail) {
  return {
    level,
    label: level === 'hot' ? 'Quente' : level === 'attention' ? 'Atenção' : 'Esfriando',
    days,
    reason,
    detail,
    atRisk: level !== 'hot',
  };
}

export function getLeadTemperature(lead, now = new Date()) {
  if (!lead || CLOSED.has(lead.status)) return null;

  const days = temperatureIdleDays(lead, now);
  const due = temperatureDayDiff(lead.nextContact, now);
  const window = WINDOWS[lead.status] || WINDOWS.Contatado;

  if (due != null && due < 0) {
    const late = Math.abs(due);
    return result(
      'cooling',
      days,
      `Follow-up atrasado há ${late} dia${late === 1 ? '' : 's'}`,
      'O retorno combinado passou e essa oportunidade está perdendo ritmo.',
    );
  }

  if (lead.status === 'Proposta enviada' && !lead.nextContact && days >= 2) {
    return result(
      'cooling',
      days,
      `Proposta parada há ${days} dia${days === 1 ? '' : 's'}`,
      'A proposta está aberta sem uma nova data de contato definida.',
    );
  }

  if (days >= window.cooling) {
    const stage = lead.status === 'Proposta enviada' ? 'A proposta' : 'A negociação';
    return result(
      'cooling',
      days,
      `${days} dias sem interação`,
      `${stage} já passou do intervalo ideal sem contato para esta etapa.`,
    );
  }

  if (days >= window.attention) {
    return result(
      'attention',
      days,
      `${days} dias sem interação`,
      'Ainda há tempo, mas vale retomar antes que a negociação esfrie de verdade.',
    );
  }

  if (!lead.nextContact && lead.status !== 'Novo lead' && days >= 1) {
    return result(
      'attention',
      days,
      'Sem próximo contato definido',
      'A negociação está aberta, mas não existe um próximo passo marcado.',
    );
  }

  return result(
    'hot',
    days,
    days === 0 ? 'Interação hoje' : days === 1 ? 'Interação ontem' : 'Interação recente',
    'A negociação está dentro de um ritmo saudável de contato.',
  );
}

export function buildCoolingWatchlist(leads, { now = new Date(), limit = 6 } = {}) {
  const stageOrder = { 'Proposta enviada': 0, Interessado: 1, Contatado: 2, 'Novo lead': 3 };
  return (Array.isArray(leads) ? leads : [])
    .map(lead => ({ lead, temperature: getLeadTemperature(lead, now) }))
    .filter(item => item.temperature?.atRisk)
    .sort((a, b) => {
      const levelDiff = (a.temperature.level === 'cooling' ? 0 : 1) - (b.temperature.level === 'cooling' ? 0 : 1);
      if (levelDiff) return levelDiff;
      const stageDiff = (stageOrder[a.lead.status] ?? 9) - (stageOrder[b.lead.status] ?? 9);
      if (stageDiff) return stageDiff;
      if (a.temperature.days !== b.temperature.days) return b.temperature.days - a.temperature.days;
      return Number(b.lead.value || 0) - Number(a.lead.value || 0);
    })
    .slice(0, Math.max(1, Number(limit) || 6));
}
