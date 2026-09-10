import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  ListChecks,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { autopilotRecommendation, buildAutopilotQueue as buildSmartAutopilotQueue } from './autopilotEngine';
import './autopilot.css';
import './autopilot-outcome.css';

const CLOSED = ['Fechado', 'Perdido'];

const OUTCOME_OPTIONS = [
  {
    id: 'talked',
    label: 'Conversei com o cliente',
    detail: 'A conversa aconteceu e a negociação continua aberta.',
    nextDays: 1,
    nextAction: 'Continuar negociação',
    tone: 'positive',
  },
  {
    id: 'no_answer',
    label: 'Não respondeu',
    detail: 'Você tentou contato, mas ainda não conseguiu uma resposta.',
    nextDays: 3,
    nextAction: 'Tentar novo contato',
    tone: 'neutral',
  },
  {
    id: 'later',
    label: 'Pediu para falar depois',
    detail: 'O cliente pediu tempo. O Fuply mantém a oportunidade viva e marca uma retomada.',
    nextDays: 3,
    nextAction: 'Retomar no combinado',
    tone: 'neutral',
  },
  {
    id: 'proposal',
    label: 'Enviei proposta',
    detail: 'A negociação avançou para proposta. O próximo objetivo é conseguir uma resposta clara.',
    nextDays: 2,
    nextAction: 'Cobrar retorno da proposta',
    status: 'Proposta enviada',
    tone: 'proposal',
  },
  {
    id: 'negotiation',
    label: 'Entrou em negociação',
    detail: 'A proposta virou uma negociação ativa. Registre o próximo passo para conduzir ao fechamento.',
    nextDays: 2,
    nextAction: 'Avançar negociação',
    status: 'Negociação',
    tone: 'proposal',
  },
  {
    id: 'won',
    label: 'Fechou',
    detail: 'Venda concluída. O lead sai da fila de follow-up e entra como fechado.',
    status: 'Fechado',
    tone: 'won',
  },
  {
    id: 'lost',
    label: 'Desistiu',
    detail: 'A negociação terminou sem venda. O lead sai da fila de follow-up.',
    status: 'Perdido',
    tone: 'lost',
  },
];

const FOLLOWUP_PRESETS = [
  { id: 'today', label: 'Hoje mais tarde', days: 0 },
  { id: 'tomorrow', label: 'Amanhã', days: 1 },
  { id: 'three-days', label: '+3 dias', days: 3 },
  { id: 'next-week', label: 'Próxima semana', days: 7 },
];

const money = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function offsetDateKey(days) {
  const next = new Date();
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + Number(days || 0));
  return dateKey(next);
}

function daysUntilDate(value) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${dateKey()}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
}

function dayDiff(value) {
  return daysUntilDate(value);
}

function daysWithoutInteraction(lead) {
  const source = lead.lastFollowupAt || lead.updatedAt || lead.createdAt;
  if (!source) return 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function prettyDate(value) {
  if (!value) return 'Não definido';
  const days = dayDiff(value);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function scoreLead(lead) {
  const due = dayDiff(lead.nextContact);
  const idleDays = daysWithoutInteraction(lead);
  const value = Number(lead.value || 0);
  const reasons = [];
  let score = 0;

  if (due != null && due < 0) {
    score += 62 + Math.min(22, Math.abs(due) * 4);
    reasons.push(`${Math.abs(due)} dia${Math.abs(due) === 1 ? '' : 's'} de atraso`);
  } else if (due === 0) {
    score += 54;
    reasons.push('follow-up marcado para hoje');
  } else if (due != null && due <= 2) {
    score += 24;
    reasons.push(due === 1 ? 'retorno marcado para amanhã' : 'retorno nos próximos 2 dias');
  }

  if (!lead.nextContact) {
    const noNextScore = lead.status === 'Proposta enviada' ? 34
      : lead.status === 'Interessado' ? 27
        : lead.status === 'Contatado' ? 20
          : 12;
    score += noNextScore;
    if (lead.status !== 'Novo lead' || idleDays >= 2) reasons.push('sem próximo contato definido');
  }

  if (idleDays >= 7) {
    score += Math.min(40, 24 + idleDays);
    reasons.push(`${idleDays} dias sem interação`);
  } else if (idleDays >= 3) {
    score += 16 + idleDays;
    reasons.push(`negociação esfriando há ${idleDays} dias`);
  }

  if (lead.status === 'Proposta enviada') {
    score += 20;
    reasons.push('proposta já enviada');
  } else if (lead.status === 'Interessado') {
    score += 10;
    reasons.push('lead demonstrou interesse');
  } else if (lead.status === 'Contatado') {
    score += 4;
  }

  if (value > 0) score += Math.min(18, Math.round(value / 500));

  const uniqueReasons = [...new Set(reasons)].slice(0, 3);
  const actionable = uniqueReasons.length > 0 && !(lead.status === 'Novo lead' && !lead.nextContact && idleDays < 2 && due == null);

  return {
    lead,
    score,
    reasons: uniqueReasons,
    idleDays,
    due,
    priority: score >= 76 ? 'high' : score >= 46 ? 'medium' : 'normal',
    actionable,
  };
}

export function buildAutopilotQueue(leads) {
  return buildSmartAutopilotQueue(leads);
}

function priorityText(priority) {
  if (priority === 'high') return 'Urgente';
  if (priority === 'medium') return 'Importante';
  return 'Revisar';
}

function recommendation(item) {
  return autopilotRecommendation(item);
}

function followupSuggestion(value) {
  const days = daysUntilDate(value);
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === 2) return 'daqui a 2 dias';
  if (days === 3) return 'daqui a 3 dias';
  if (days === 7) return 'na próxima semana';
  return prettyDate(value).toLowerCase();
}

export default function Autopilot({ open, onClose, leads, openLead, openWhatsApp, onOutcome }) {
  const liveQueue = useMemo(() => buildAutopilotQueue(leads), [leads]);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [handled, setHandled] = useState([]);
  const [whatsapps, setWhatsapps] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [registered, setRegistered] = useState(0);
  const [wonCount, setWonCount] = useState(0);
  const [lostCount, setLostCount] = useState(0);
  const [awaitingOutcome, setAwaitingOutcome] = useState(false);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupAction, setFollowupAction] = useState('');
  const [outcomeError, setOutcomeError] = useState('');

  const remaining = sessionQueue.filter(item => !handled.includes(item.lead.id));
  const currentBase = remaining[0] || null;
  const currentLead = currentBase ? (leads.find(lead => lead.id === currentBase.lead.id) || currentBase.lead) : null;
  const current = currentBase ? { ...currentBase, lead: currentLead } : null;
  const total = sessionQueue.length;
  const done = Math.min(handled.length, total);
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 100;
  const suggestion = current ? recommendation(current) : null;
  const selectedOutcome = OUTCOME_OPTIONS.find(option => option.id === selectedOutcomeId) || null;
  const needsFollowup = Boolean(selectedOutcome && !(selectedOutcome.status && CLOSED.includes(selectedOutcome.status)));
  const suggestedDate = selectedOutcome?.nextDays != null ? offsetDateKey(selectedOutcome.nextDays) : '';

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setSessionQueue(liveQueue);
      setHandled([]);
      setWhatsapps(0);
      setSkipped(0);
      setRegistered(0);
      setWonCount(0);
      setLostCount(0);
      setAwaitingOutcome(false);
      setSelectedOutcomeId('');
      setSaleValue('');
      setFollowupDate('');
      setFollowupAction('');
      setOutcomeError('');
    }
  }, [open]);

  useEffect(() => {
    if (!current) return;
    setAwaitingOutcome(false);
    setSelectedOutcomeId('');
    setSaleValue(String(Number(current.lead.value || 0) > 0 ? Number(current.lead.value) : ''));
    setFollowupDate('');
    setFollowupAction('');
    setOutcomeError('');
  }, [current?.lead.id]);

  if (!open) return null;

  const markHandled = id => setHandled(ids => ids.includes(id) ? ids : [...ids, id]);

  const contact = () => {
    if (!current) return;
    const opened = openWhatsApp(current.lead, '', { skipFollowupPrompt: true, source: 'autopilot' });
    if (opened === false) {
      setOutcomeError('Esse lead não tem um WhatsApp válido para abrir.');
      return;
    }
    setWhatsapps(value => value + 1);
    setAwaitingOutcome(true);
    setSelectedOutcomeId('');
    setSaleValue(String(Number(current.lead.value || 0) > 0 ? Number(current.lead.value) : ''));
    setFollowupDate('');
    setFollowupAction('');
    setOutcomeError('');
  };

  const chooseOutcome = id => {
    const option = OUTCOME_OPTIONS.find(item => item.id === id);
    setSelectedOutcomeId(id);
    setFollowupDate(option?.nextDays != null ? offsetDateKey(option.nextDays) : '');
    setFollowupAction(option?.nextAction || '');
    setOutcomeError('');
  };

  const choosePreset = days => {
    setFollowupDate(offsetDateKey(days));
    setOutcomeError('');
  };

  const registerOutcome = () => {
    if (!current || !selectedOutcome) {
      setOutcomeError('Escolha o que aconteceu antes de continuar.');
      return;
    }

    if (selectedOutcome.id === 'won') {
      const value = Number(saleValue);
      if (!Number.isFinite(value) || value <= 0) {
        setOutcomeError('Informe o valor final da venda para fechar esse lead.');
        return;
      }
    }

    let nextDays = null;
    if (needsFollowup) {
      nextDays = daysUntilDate(followupDate);
      if (nextDays == null || nextDays < 0) {
        setOutcomeError('Escolha hoje ou uma data futura para o próximo contato.');
        return;
      }
    }

    const applied = onOutcome?.({
      leadId: current.lead.id,
      outcome: selectedOutcome.id,
      label: selectedOutcome.label,
      status: selectedOutcome.status || null,
      nextDays,
      nextAction: needsFollowup ? (followupAction.trim() || selectedOutcome.nextAction || 'Retornar contato') : '',
      saleValue: selectedOutcome.id === 'won' ? Number(saleValue) : null,
    });

    if (applied === false) {
      setOutcomeError('Não foi possível registrar esse resultado. Confira os dados e tente novamente.');
      return;
    }

    setRegistered(value => value + 1);
    if (selectedOutcome.id === 'won') setWonCount(value => value + 1);
    if (selectedOutcome.id === 'lost') setLostCount(value => value + 1);
    markHandled(current.lead.id);
    setAwaitingOutcome(false);
    setSelectedOutcomeId('');
    setFollowupDate('');
    setFollowupAction('');
    setOutcomeError('');
  };

  const skip = () => {
    if (!current) return;
    setSkipped(value => value + 1);
    markHandled(current.lead.id);
    setAwaitingOutcome(false);
    setSelectedOutcomeId('');
    setFollowupDate('');
    setFollowupAction('');
    setOutcomeError('');
  };

  const inspect = () => {
    if (!current) return;
    onClose?.();
    openLead(current.lead);
  };

  const restart = () => {
    setSessionQueue(liveQueue);
    setHandled([]);
    setWhatsapps(0);
    setSkipped(0);
    setRegistered(0);
    setWonCount(0);
    setLostCount(0);
    setAwaitingOutcome(false);
    setSelectedOutcomeId('');
    setSaleValue('');
    setFollowupDate('');
    setFollowupAction('');
    setOutcomeError('');
  };

  return (
    <div className="autopilot-backdrop" onMouseDown={onClose}>
      <section className="autopilot-modal" role="dialog" aria-modal="true" aria-labelledby="autopilot-title" onMouseDown={event => event.stopPropagation()}>
        <header className="autopilot-topbar">
          <div className="autopilot-brand">
            <span><Sparkles size={17} /></span>
            <div><strong>Fuply Autopilot</strong><small>Modo execução · decide a ordem, você fecha a venda</small></div>
          </div>
          <button type="button" className="autopilot-close" onClick={onClose} aria-label="Fechar Autopilot"><X size={19} /></button>
        </header>

        <div className="autopilot-progress-row">
          <div className="autopilot-progress-copy">
            <strong>{current ? `${done + 1} de ${total}` : `${total} de ${total}`}</strong>
            <span>{current ? (awaitingOutcome ? 'registrar resultado' : 'ação atual') : 'fila concluída'}</span>
          </div>
          <div className="autopilot-progress"><span style={{ width: `${progress}%` }} /></div>
          <span className="autopilot-progress-percent">{progress}%</span>
        </div>

        {current ? (
          <div className="autopilot-layout" key={current.lead.id}>
            <aside className="autopilot-queue-panel">
              <div className="autopilot-queue-head"><ListChecks size={16} /><div><strong>Fila de hoje</strong><span>{remaining.length} ação{remaining.length === 1 ? '' : 'ões'} restante{remaining.length === 1 ? '' : 's'}</span></div></div>
              <div className="autopilot-queue-list">
                {remaining.slice(0, 7).map((item, index) => (
                  <div className={`autopilot-queue-item ${index === 0 ? 'active' : ''}`} key={item.lead.id}>
                    <span className={`autopilot-queue-number ${item.priority}`}>{index + 1}</span>
                    <div><strong>{item.lead.name}</strong><span>{item.lead.status} · {money(item.lead.value)}</span></div>
                    {index === 0 && <ChevronRight size={15} />}
                  </div>
                ))}
              </div>
              {remaining.length > 7 && <div className="autopilot-queue-more">+{remaining.length - 7} depois</div>}
              <div className="autopilot-queue-rule"><Sparkles size={14} /><span>Urgência vem antes de valor. A fila considera prazo, etapa, tempo sem contato e potencial sem deixar um lead caro atropelar um follow-up vencido.</span></div>
            </aside>

            <div className="autopilot-workspace">
              <div className="autopilot-priority-line">
                <span className={`autopilot-priority ${current.priority}`}><Flame size={14} /> {priorityText(current.priority)}</span>
                <span className="autopilot-position">{awaitingOutcome ? 'Resultado do contato' : 'Próxima melhor ação'}</span>
              </div>

              <div className="autopilot-lead-head">
                <div className="autopilot-avatar">{current.lead.name.slice(0, 2).toUpperCase()}</div>
                <div className="autopilot-lead-copy"><h2 id="autopilot-title">{current.lead.name}</h2><p>{current.lead.company || current.lead.origin || 'Sem empresa informada'}</p></div>
                <div className="autopilot-value"><span>Valor em jogo</span><strong>{money(current.lead.value)}</strong></div>
              </div>

              <div className="autopilot-facts">
                <div><Target size={16} /><span>Etapa</span><strong>{current.lead.status}</strong></div>
                <div><Clock3 size={16} /><span>Sem interação</span><strong>{current.idleDays === 0 ? 'Hoje' : `${current.idleDays} dia${current.idleDays === 1 ? '' : 's'}`}</strong></div>
                <div><CalendarClock size={16} /><span>Próximo contato</span><strong>{prettyDate(current.lead.nextContact)}{current.lead.nextContactTime ? ` · ${current.lead.nextContactTime}` : ''}</strong></div>
              </div>

              {!awaitingOutcome && (
                <>
                  <div className="autopilot-reasons">
                    <span>Por que esse lead está nesta posição</span>
                    <div>{current.reasons.map((reason, index) => <b key={reason}>{index === 0 ? `Motivo principal · ${reason}` : reason}</b>)}</div>
                  </div>

                  <div className="autopilot-suggestion">
                    <div className="autopilot-suggestion-icon"><Sparkles size={19} /></div>
                    <div><span>Faça isso agora</span><strong>{suggestion.title}</strong><p>{suggestion.detail}</p></div>
                  </div>

                  <div className="autopilot-actions">
                    <button type="button" className="autopilot-whatsapp" onClick={contact}><MessageCircle size={18} /> Abrir WhatsApp <ArrowRight size={16} /></button>
                    <button type="button" className="autopilot-inspect" onClick={inspect}>Ver negociação</button>
                    <button type="button" className="autopilot-skip" onClick={skip}>Pular por agora</button>
                  </div>
                  <div className="autopilot-after-contact"><CheckCircle2 size={14} /><span>Quando você voltar do WhatsApp, o Autopilot pergunta o que aconteceu e já sugere quando falar com o cliente de novo.</span></div>
                </>
              )}

              {awaitingOutcome && (
                <section className="autopilot-outcome-shell" aria-label="Resultado do contato">
                  <div className="autopilot-outcome-heading">
                    <div className="autopilot-outcome-icon"><MessageCircle size={18} /></div>
                    <div><span>WhatsApp aberto</span><h3>O que aconteceu com {current.lead.name}?</h3><p>Escolha o resultado real da conversa. O Fuply atualiza a negociação antes de liberar o próximo lead.</p></div>
                  </div>

                  <div className="autopilot-outcome-grid">
                    {OUTCOME_OPTIONS.map(option => (
                      <button
                        type="button"
                        key={option.id}
                        className={`autopilot-outcome-option ${option.tone} ${selectedOutcomeId === option.id ? 'selected' : ''}`}
                        onClick={() => chooseOutcome(option.id)}
                        aria-pressed={selectedOutcomeId === option.id}
                      >
                        <span className="autopilot-outcome-check">{selectedOutcomeId === option.id ? <CheckCircle2 size={15} /> : null}</span>
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </button>
                    ))}
                  </div>

                  {selectedOutcome && (
                    <div className={`autopilot-outcome-plan ${selectedOutcome.tone}`}>
                      <div>
                        <span>O Fuply vai registrar</span>
                        <strong>{selectedOutcome.label}</strong>
                        {selectedOutcome.status && <p>Status → <b>{selectedOutcome.status}</b></p>}
                        {needsFollowup && followupDate && <p>Próximo passo → <b>{followupAction || selectedOutcome.nextAction || 'Retornar contato'}</b> {followupSuggestion(followupDate)}</p>}
                        {selectedOutcome.status && CLOSED.includes(selectedOutcome.status) && <p>Esse lead sai da fila de follow-up.</p>}
                      </div>
                      {selectedOutcome.id === 'won' && (
                        <label className="autopilot-sale-value">
                          <span>Valor final da venda</span>
                          <input type="number" min="0.01" step="0.01" value={saleValue} onChange={event => setSaleValue(event.target.value)} placeholder="0,00" />
                        </label>
                      )}
                    </div>
                  )}

                  {selectedOutcome && needsFollowup && (
                    <div className="autopilot-followup-picker">
                      <div className="autopilot-followup-head">
                        <div><span>Próximo contato</span><strong>Quando você quer voltar nesse cliente?</strong></div>
                        {suggestedDate && followupDate === suggestedDate && <b><Sparkles size={12} /> Sugestão do Fuply</b>}
                      </div>
                      <div className="autopilot-followup-presets" aria-label="Atalhos para próximo contato">
                        {FOLLOWUP_PRESETS.map(preset => {
                          const presetDate = offsetDateKey(preset.days);
                          return (
                            <button type="button" key={preset.id} className={followupDate === presetDate ? 'active' : ''} onClick={() => choosePreset(preset.days)}>
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="autopilot-followup-fields">
                        <label>
                          <span>Escolher data</span>
                          <input type="date" min={dateKey()} value={followupDate} onChange={event => { setFollowupDate(event.target.value); setOutcomeError(''); }} />
                        </label>
                        <label>
                          <span>Próxima ação</span>
                          <input value={followupAction} onChange={event => setFollowupAction(event.target.value)} placeholder="Ex.: Cobrar retorno" />
                        </label>
                      </div>
                    </div>
                  )}

                  {outcomeError && <div className="autopilot-outcome-error" role="alert">{outcomeError}</div>}

                  <div className="autopilot-outcome-actions">
                    <button type="button" className="autopilot-whatsapp" disabled={!selectedOutcome} onClick={registerOutcome}><CheckCircle2 size={17} /> Registrar e continuar <ArrowRight size={15} /></button>
                    <button type="button" className="autopilot-inspect" onClick={contact}><MessageCircle size={16} /> Abrir WhatsApp de novo</button>
                    <button type="button" className="autopilot-skip" onClick={skip}>Não registrar agora</button>
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : (
          <div className="autopilot-finish">
            <div className="autopilot-finish-icon"><CheckCircle2 size={35} /></div>
            <span>Fila zerada</span>
            <h2 id="autopilot-title">Você terminou as prioridades de agora.</h2>
            <p>{registered ? `O Fuply registrou ${registered} resultado${registered === 1 ? '' : 's'} e já reorganizou o que precisa acontecer depois.${wonCount ? ` ${wonCount} venda${wonCount === 1 ? '' : 's'} fechada${wonCount === 1 ? '' : 's'}.` : ''}${lostCount ? ` ${lostCount} negociação${lostCount === 1 ? '' : 'ões'} encerrada${lostCount === 1 ? '' : 's'}.` : ''}` : 'Você percorreu a fila prioritária. Os leads pulados continuam disponíveis para uma próxima sessão.'}</p>
            <div className="autopilot-finish-stats autopilot-finish-stats-four">
              <div><strong>{total}</strong><span>ações revisadas</span></div>
              <div><strong>{whatsapps}</strong><span>WhatsApps abertos</span></div>
              <div><strong>{registered}</strong><span>resultados registrados</span></div>
              <div><strong>{skipped}</strong><span>puladas</span></div>
            </div>
            <div className="autopilot-finish-actions">
              <button type="button" className="autopilot-whatsapp" onClick={onClose}>Voltar ao Dashboard</button>
              {total > 0 && <button type="button" className="autopilot-inspect" onClick={restart}><RotateCcw size={15} /> Recalcular fila</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
