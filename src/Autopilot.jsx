import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import './autopilot.css';

const CLOSED = ['Vendido', 'Perdido'];
const STATUS_WEIGHT = {
  'Proposta enviada': 30,
  Interessado: 22,
  Contatado: 12,
  'Novo lead': 6,
};

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
  return Math.round((target - today) / 86400000);
}

function daysWithoutInteraction(lead) {
  const source = lead.lastFollowupAt || lead.updatedAt || lead.createdAt;
  if (!source) return 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function scoreLead(lead) {
  let score = STATUS_WEIGHT[lead.status] || 0;
  const reasons = [];
  const due = dayDiff(lead.nextContact);
  const idleDays = daysWithoutInteraction(lead);
  const value = Number(lead.value || 0);

  if (due != null && due < 0) {
    score += 45 + Math.min(20, Math.abs(due) * 4);
    reasons.push(`${Math.abs(due)} dia${Math.abs(due) === 1 ? '' : 's'} atrasado${Math.abs(due) === 1 ? '' : 's'}`);
  } else if (due === 0) {
    score += 38;
    reasons.push('follow-up marcado para hoje');
  } else if (due != null && due <= 2) {
    score += 18;
    reasons.push('próximo contato chegando');
  }

  if (!lead.nextContact) {
    score += 20;
    reasons.push('sem próximo contato definido');
  }

  if (idleDays >= 7) {
    score += Math.min(28, 12 + idleDays * 2);
    reasons.push(`${idleDays} dias sem interação`);
  } else if (idleDays >= 3) {
    score += 10 + idleDays * 2;
    reasons.push(`negociação esfriando há ${idleDays} dias`);
  }

  if (lead.status === 'Proposta enviada') reasons.push('proposta já enviada');
  else if (lead.status === 'Interessado') reasons.push('lead demonstrou interesse');

  if (value > 0) score += Math.min(22, Math.round(value / 400));

  return {
    lead,
    score,
    reasons: reasons.slice(0, 3),
    idleDays,
    due,
    priority: score >= 72 ? 'high' : score >= 42 ? 'medium' : 'normal',
  };
}

export function buildAutopilotQueue(leads) {
  return leads
    .filter(lead => !CLOSED.includes(lead.status))
    .map(scoreLead)
    .filter(item => item.score >= 18)
    .sort((a, b) => b.score - a.score || Number(b.lead.value || 0) - Number(a.lead.value || 0));
}

function priorityText(priority) {
  if (priority === 'high') return 'Prioridade alta';
  if (priority === 'medium') return 'Prioridade média';
  return 'Revisar';
}

function suggestedAction(item) {
  if (item.due != null && item.due < 0) return 'Faça o follow-up agora e já deixe o próximo contato marcado.';
  if (item.due === 0) return 'Esse contato é de hoje. Resolva antes de ele virar atraso.';
  if (item.lead.status === 'Proposta enviada') return 'Cheque a proposta e tente destravar uma resposta.';
  if (!item.lead.nextContact) return 'Converse com o lead e defina o próximo passo antes de sair.';
  if (item.idleDays >= 7) return 'Reative a conversa antes que essa oportunidade morra de vez.';
  return 'Revise a conversa e avance a negociação para o próximo passo.';
}

export default function Autopilot({ open, onClose, leads, openLead, openWhatsApp }) {
  const queue = useMemo(() => buildAutopilotQueue(leads), [leads]);
  const [handled, setHandled] = useState([]);
  const [whatsapps, setWhatsapps] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const remaining = queue.filter(item => !handled.includes(item.lead.id));
  const current = remaining[0] || null;
  const total = queue.length;
  const done = handled.length;
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 100;

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

  const markHandled = id => setHandled(currentIds => currentIds.includes(id) ? currentIds : [...currentIds, id]);

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
          <div className="autopilot-brand"><span><Sparkles size={16} /></span><div><strong>Autopilot</strong><small>Fila inteligente de oportunidades</small></div></div>
          <button type="button" className="autopilot-close" onClick={onClose} aria-label="Fechar Autopilot"><X size={19} /></button>
        </header>

        <div className="autopilot-progress-row">
          <div><strong>{current ? `${done + 1} de ${total}` : `${total} de ${total}`}</strong><span>{current ? 'oportunidades revisadas' : 'sessão concluída'}</span></div>
          <div className="autopilot-progress"><span style={{ width: `${progress}%` }} /></div>
        </div>

        {current ? (
          <div className="autopilot-workspace" key={current.lead.id}>
            <div className="autopilot-priority-line">
              <span className={`autopilot-priority ${current.priority}`}><Flame size={14} /> {priorityText(current.priority)}</span>
              <span className="autopilot-score">score {current.score}</span>
            </div>

            <div className="autopilot-lead-head">
              <div className="autopilot-avatar">{current.lead.name.slice(0, 2).toUpperCase()}</div>
              <div><h2 id="autopilot-title">{current.lead.name}</h2><p>{current.lead.company || current.lead.origin || 'Sem empresa informada'}</p></div>
              <div className="autopilot-value"><span>Em jogo</span><strong>{money(current.lead.value)}</strong></div>
            </div>

            <div className="autopilot-facts">
              <div><Target size={16} /><span>Status</span><strong>{current.lead.status}</strong></div>
              <div><Clock3 size={16} /><span>Última interação</span><strong>{current.idleDays === 0 ? 'Hoje' : `há ${current.idleDays} dia${current.idleDays === 1 ? '' : 's'}`}</strong></div>
              <div><CalendarClock size={16} /><span>Próximo contato</span><strong>{current.lead.nextContact || 'Não definido'}</strong></div>
            </div>

            <div className="autopilot-reasons">
              <span>Por que está na sua frente</span>
              <div>{current.reasons.map(reason => <b key={reason}>{reason}</b>)}</div>
            </div>

            <div className="autopilot-suggestion">
              <Sparkles size={18} />
              <div><span>Próxima ação recomendada</span><strong>{suggestedAction(current)}</strong></div>
            </div>

            <div className="autopilot-actions">
              <button type="button" className="autopilot-whatsapp" onClick={contact}><MessageCircle size={18} /> Abrir WhatsApp <ArrowRight size={16} /></button>
              <button type="button" className="autopilot-inspect" onClick={inspect}>Abrir negociação</button>
              <button type="button" className="autopilot-skip" onClick={skip}>Pular por agora</button>
            </div>
            <p className="autopilot-note">Ao abrir o WhatsApp, o sistema já pergunta quando você quer falar com esse cliente novamente.</p>
          </div>
        ) : (
          <div className="autopilot-finish">
            <div className="autopilot-finish-icon"><CheckCircle2 size={34} /></div>
            <span>Sessão concluída</span>
            <h2 id="autopilot-title">Você zerou sua fila prioritária.</h2>
            <p>O Autopilot organizou as oportunidades mais importantes para você não precisar decidir quem merece atenção primeiro.</p>
            <div className="autopilot-finish-stats">
              <div><strong>{total}</strong><span>revisadas</span></div>
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
