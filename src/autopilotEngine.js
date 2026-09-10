const CLOSED = new Set(['Fechado', 'Perdido']);

const STATUS_WEIGHT = {
  'Negociação': 40,
  'Proposta enviada': 34,
  Interessado: 20,
  Contatado: 10,
  'Novo lead': 4,
};

const STATUS_ORDER = {
  'Negociação': 0,
  'Proposta enviada': 1,
  Interessado: 2,
  Contatado: 3,
  'Novo lead': 4,
};

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayDiff(value, now = new Date()) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${localDateKey(now)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
}

export function daysWithoutInteraction(lead, now = new Date()) {
  const source = lead?.lastFollowupAt || lead?.updatedAt || lead?.createdAt;
  if (!source) return 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function valueWeight(rawValue) {
  const value = Number(rawValue || 0);
  if (value >= 10000) return 18;
  if (value >= 5000) return 15;
  if (value >= 2500) return 12;
  if (value >= 1000) return 9;
  if (value >= 500) return 6;
  if (value > 0) return 3;
  return 0;
}

function coolingThreshold(status) {
  if (status === 'Negociação') return 2;
  if (status === 'Proposta enviada') return 2;
  if (status === 'Interessado') return 3;
  if (status === 'Contatado') return 4;
  return 2;
}

function pushReason(reasons, text, weight, type) {
  if (!text || reasons.some(reason => reason.text === text)) return;
  reasons.push({ text, weight, type });
}

function priorityFromScore(score) {
  if (score >= 105) return 'high';
  if (score >= 64) return 'medium';
  return 'normal';
}

function urgencyRank({ due, lead, idleDays }) {
  if (due != null && due < 0) return 0;
  if (due === 0) return 1;
  if (lead.status === 'Negociação' && !lead.nextContact) return 2;
  if (lead.status === 'Negociação' && idleDays >= 2) return 3;
  if (lead.status === 'Proposta enviada' && !lead.nextContact) return 4;
  if (lead.status === 'Proposta enviada' && idleDays >= 2) return 5;
  if (!lead.nextContact && ['Interessado', 'Contatado'].includes(lead.status)) return 4;
  if (idleDays >= coolingThreshold(lead.status)) return 5;
  if (lead.status === 'Novo lead' && !lead.nextContact) return 6;
  if (due === 1) return 7;
  if (due === 2) return 8;
  return 9;
}

export function scoreAutopilotLead(lead, now = new Date()) {
  if (!lead || CLOSED.has(lead.status)) {
    return {
      lead,
      score: 0,
      priority: 'normal',
      reasons: [],
      reasonDetails: [],
      primaryReason: '',
      idleDays: 0,
      due: null,
      actionable: false,
      urgencyRank: 99,
    };
  }

  const due = dayDiff(lead.nextContact, now);
  const idleDays = daysWithoutInteraction(lead, now);
  const reasons = [];
  let score = STATUS_WEIGHT[lead.status] || 0;
  let operationalSignal = false;

  if (due != null && due < 0) {
    const lateDays = Math.abs(due);
    const weight = 90 + Math.min(30, lateDays * 5);
    score += weight;
    operationalSignal = true;
    pushReason(reasons, `follow-up atrasado há ${lateDays} dia${lateDays === 1 ? '' : 's'}`, weight, 'overdue');
  } else if (due === 0) {
    score += 78;
    operationalSignal = true;
    pushReason(reasons, 'follow-up marcado para hoje', 78, 'today');
  } else if (due === 1) {
    score += 30;
    operationalSignal = true;
    pushReason(reasons, 'retorno marcado para amanhã', 30, 'upcoming');
  } else if (due === 2 && ['Negociação', 'Proposta enviada'].includes(lead.status)) {
    score += 18;
    operationalSignal = true;
    pushReason(reasons, 'proposta com retorno nos próximos 2 dias', 18, 'upcoming');
  }

  if (!lead.nextContact) {
    const weight = lead.status === 'Negociação' ? 48
      : lead.status === 'Proposta enviada' ? 42
        : lead.status === 'Interessado' ? 32
        : lead.status === 'Contatado' ? 22
          : 15;
    score += weight;
    operationalSignal = true;
    pushReason(reasons, lead.status === 'Novo lead' ? 'novo lead sem primeiro contato definido' : 'sem próximo contato definido', weight, 'unscheduled');
  }

  const threshold = coolingThreshold(lead.status);
  if (idleDays >= threshold) {
    const severe = idleDays >= 7;
    const weight = severe
      ? Math.min(46, 24 + idleDays * 2)
      : Math.min(30, 10 + idleDays * 3);
    score += weight;
    operationalSignal = true;
    pushReason(
      reasons,
      severe ? `${idleDays} dias sem interação` : `negociação esfriando há ${idleDays} dias`,
      weight,
      severe ? 'cold' : 'cooling',
    );
  }

  if (lead.status === 'Negociação') {
    operationalSignal = true;
    pushReason(reasons, 'negociação ativa', STATUS_WEIGHT['Negociação'], 'stage');
  } else if (lead.status === 'Proposta enviada') {
    operationalSignal = true;
    pushReason(reasons, 'proposta já enviada', STATUS_WEIGHT['Proposta enviada'], 'stage');
  } else if (lead.status === 'Interessado') {
    pushReason(reasons, 'lead demonstrou interesse', STATUS_WEIGHT.Interessado, 'stage');
  }

  const moneyWeight = valueWeight(lead.value);
  score += moneyWeight;
  if (moneyWeight >= 9) pushReason(reasons, 'alto valor potencial', moneyWeight, 'value');

  const sortedReasons = [...reasons].sort((a, b) => b.weight - a.weight);
  const actionable = operationalSignal && score >= 34;
  const rank = urgencyRank({ due, lead, idleDays });

  return {
    lead,
    score,
    priority: priorityFromScore(score),
    reasons: sortedReasons.slice(0, 3).map(reason => reason.text),
    reasonDetails: sortedReasons.slice(0, 4),
    primaryReason: sortedReasons[0]?.text || '',
    idleDays,
    due,
    actionable,
    urgencyRank: rank,
  };
}

export function autopilotRecommendation(item) {
  if (!item) return { title: 'Revise a negociação', detail: 'Confira o contexto e defina o próximo passo.' };
  if (item.due != null && item.due < 0) return {
    title: 'Retome esse contato agora',
    detail: 'O prazo já passou. Priorize esse lead antes de trabalhar oportunidades menos urgentes.',
  };
  if (item.due === 0) return {
    title: 'Resolva o contato de hoje',
    detail: 'Esse retorno já estava combinado. Faça o contato e registre o resultado antes de seguir.',
  };
  if (item.lead.status === 'Negociação' && !item.lead.nextContact) return {
    title: 'Defina o próximo passo da negociação',
    detail: 'A negociação está ativa, mas sem uma próxima ação marcada. Defina o retorno e conduza o lead para uma decisão.',
  };
  if (item.lead.status === 'Negociação') return {
    title: 'Conduza para uma decisão',
    detail: 'Esse lead já está negociando. Resolva objeções, ajuste o necessário e busque um sim ou não claro.',
  };
  if (item.lead.status === 'Proposta enviada' && !item.lead.nextContact) return {
    title: 'Não deixe a proposta sem retorno',
    detail: 'A proposta está aberta e sem uma próxima data. Busque uma resposta e deixe o próximo passo marcado.',
  };
  if (item.lead.status === 'Proposta enviada') return {
    title: 'Destrave a proposta',
    detail: 'Consiga uma resposta clara: avançar, ajustar a proposta ou encerrar a negociação.',
  };
  if (!item.lead.nextContact) return {
    title: item.lead.status === 'Novo lead' ? 'Faça o primeiro contato' : 'Defina o próximo passo',
    detail: item.lead.status === 'Novo lead'
      ? 'Esse lead entrou no CRM e ainda não tem uma ação marcada. Faça o primeiro contato e registre o resultado.'
      : 'Essa negociação está aberta sem data de retorno. Fale com o lead e deixe a próxima ação definida.',
  };
  if (item.idleDays >= 7) return {
    title: 'Reative antes que esfrie de vez',
    detail: 'Já passou tempo demais sem interação. Faça uma retomada objetiva antes de a oportunidade desaparecer.',
  };
  if (item.idleDays >= coolingThreshold(item.lead.status)) return {
    title: 'Evite que essa negociação esfrie',
    detail: 'O tempo sem interação já passou do ideal para essa etapa. Faça um contato curto e avance o próximo passo.',
  };
  return {
    title: 'Avance a negociação',
    detail: 'Execute o próximo passo mais simples que aproxime esse lead de uma decisão.',
  };
}

export function buildAutopilotQueue(leads, { now = new Date(), limit = 12 } = {}) {
  return (Array.isArray(leads) ? leads : [])
    .filter(lead => !CLOSED.has(lead?.status))
    .map(lead => scoreAutopilotLead(lead, now))
    .filter(item => item.actionable)
    .sort((a, b) => {
      if (a.urgencyRank !== b.urgencyRank) return a.urgencyRank - b.urgencyRank;
      if (a.score !== b.score) return b.score - a.score;
      const stageDiff = (STATUS_ORDER[a.lead.status] ?? 9) - (STATUS_ORDER[b.lead.status] ?? 9);
      if (stageDiff) return stageDiff;
      const valueDiff = Number(b.lead.value || 0) - Number(a.lead.value || 0);
      if (valueDiff) return valueDiff;
      return b.idleDays - a.idleDays;
    })
    .slice(0, Math.max(1, Number(limit) || 12));
}
