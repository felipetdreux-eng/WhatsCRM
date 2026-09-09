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
import './autopilot.css';

const CLOSED = ['Vendido', 'Perdido'];

const money = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayDiff(value) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${dateKey()}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
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
  return leads
    .filter(lead => !CLOSED.includes(lead.status))
    .map(scoreLead)
    .filter(item => item.actionable && item.score >= 24)
    .sort((a, b) => b.score - a.score || Number(b.lead.value || 0) - Number(a.lead.value || 0))
    .slice(0, 12);
}

function priorityText(priority) {
  if (priority === 'high') return 'Urgente';
  if (priority === 'medium') return 'Importante';
  return 'Revisar';
}

function recommendation(item) {
  if (item.due != null && item.due < 0) return {
    title: 'Retome esse contato agora',
    detail: 'O follow-up já venceu. Abra a conversa, avance a negociação e deixe o próximo passo marcado antes de seguir.',
  };
  if (item.due === 0) return {
    title: 'Resolva o contato de hoje',
    detail: 'Esse lead já estava na sua agenda. Faça o retorno agora para ele não virar atraso amanhã.',
  };
  if (item.lead.status === 'Proposta enviada') return {
    title: 'Destrave a proposta',
    detail: 'A proposta já saiu. O objetivo agora é conseguir uma resposta clara: avançar, ajustar ou encerrar.',
  };
  if (!item.lead.nextContact) return {
    title: 'Defina o próximo passo',
    detail: 'Essa negociação está aberta sem data de retorno. Fale com o lead e não saia sem deixar o próximo contato marcado.',
  };
  if (item.idleDays >= 7) return {
    title: 'Reative antes que esfrie de vez',
    detail: 'Já passou tempo demais sem interação. Uma retomada curta agora vale mais do que deixar esse lead morrer silenciosamente.',
  };
  return {
    title: 'Avance a negociação',
    detail: 'Revise a conversa e execute o próximo passo mais simples que aproxime esse lead de uma decisão.',
  };
}

export default function Autopilot({ open, onClose, leads, openLead, openWhatsApp }) {
  const queue = useMemo(() => buildAutopilotQueue(leads), [leads]);
  const [handled, setHandled] = useState([]);
  const [whatsapps, setWhatsapps] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const remaining = queue.filter(item => !handled.includes(item.lead.id));
  const current = remaining[0] || null;
  const total = queue.length;
  const done = Math.min(handled.length, total);
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 100;
  const suggestion = current ? recommendation(current) : null;

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
      setHandled([]);
      setWhatsapps(0);
      setSkipped(0);
    }
  }, [open]);

  if (!open) return null;

  const markHandled = id => setHandled(ids => ids.includes(id) ? ids : [...ids, id]);

  const contact = () => {
    if (!current) return;
    openWhatsApp(current.lead);
    setWhatsapps(value => value + 1);
    markHandled(current.lead.id);
  };

  const skip = () => {
    if (!current) return;
    setSkipped(value => value + 1);
    markHandled(current.lead.id);
  };

  const inspect = () => {
    if (!current) return;
    onClose?.();
    openLead(current.lead);
  };

  const restart = () => {
    setHandled([]);
    setWhatsapps(0);
    setSkipped(0);
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
            <span>{current ? 'ação atual' : 'fila concluída'}</span>
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
              <div className="autopilot-queue-rule"><Sparkles size={14} /><span>Ordem calculada por prazo, estágio, valor e tempo sem resposta.</span></div>
            </aside>

            <div className="autopilot-workspace">
              <div className="autopilot-priority-line">
                <span className={`autopilot-priority ${current.priority}`}><Flame size={14} /> {priorityText(current.priority)}</span>
                <span className="autopilot-position">Próxima melhor ação</span>
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

              <div className="autopilot-reasons">
                <span>Por que esse lead veio primeiro</span>
                <div>{current.reasons.map(reason => <b key={reason}>{reason}</b>)}</div>
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
              <div className="autopilot-after-contact"><CheckCircle2 size={14} /><span>Ao abrir o WhatsApp, a janela de próximo contato aparece por cima. Salve a data e o Autopilot já deixa o próximo lead pronto.</span></div>
            </div>
          </div>
        ) : (
          <div className="autopilot-finish">
            <div className="autopilot-finish-icon"><CheckCircle2 size={35} /></div>
            <span>Fila zerada</span>
            <h2 id="autopilot-title">Você terminou as prioridades de agora.</h2>
            <p>Em vez de caçar lead por lead no CRM, você percorreu a fila que tinha maior chance de exigir atenção primeiro.</p>
            <div className="autopilot-finish-stats">
              <div><strong>{total}</strong><span>ações revisadas</span></div>
              <div><strong>{whatsapps}</strong><span>WhatsApps abertos</span></div>
              <div><strong>{skipped}</strong><span>puladas</span></div>
            </div>
            <div className="autopilot-finish-actions">
              <button type="button" className="autopilot-whatsapp" onClick={onClose}>Voltar ao Dashboard</button>
              {total > 0 && <button type="button" className="autopilot-inspect" onClick={restart}><RotateCcw size={15} /> Rever fila</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
