import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import './followups.css';

const CLOSED = ['Vendido', 'Perdido'];
const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Vendido', 'Perdido'];

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateAtNoon(value) {
  return new Date(`${value}T12:00:00`);
}

function dayDiff(value) {
  const today = dateAtNoon(todayKey());
  const date = dateAtNoon(value);
  return Math.round((date - today) / 86400000);
}

function humanDate(value) {
  if (!value) return '';
  const diff = dayDiff(value);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  if (diff < -1) return `${Math.abs(diff)} dias atrás`;
  return dateAtNoon(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function fullDate(value) {
  return dateAtNoon(value).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short',
  }).replace('.', '');
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(' ', '-');
}

function groupByDate(items) {
  return {
    overdue: items.filter(lead => dayDiff(lead.nextContact) < 0),
    today: items.filter(lead => dayDiff(lead.nextContact) === 0),
    week: items.filter(lead => dayDiff(lead.nextContact) > 0 && dayDiff(lead.nextContact) <= 7),
    later: items.filter(lead => dayDiff(lead.nextContact) > 7),
  };
}

function FollowUpCard({ lead, openLead, openWhatsApp, complete, reschedule, updateStatus }) {
  const diff = dayDiff(lead.nextContact);
  const overdue = diff < 0;
  const today = diff === 0;

  return (
    <article className={`followup-row ${overdue ? 'is-overdue' : ''}`}>
      <button className="followup-main" onClick={() => openLead(lead)}>
        <div className={`followup-date-tile ${overdue ? 'overdue' : today ? 'today' : ''}`}>
          <strong>{dateAtNoon(lead.nextContact).getDate()}</strong>
          <span>{dateAtNoon(lead.nextContact).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
        </div>
        <div className="followup-copy">
          <div className="followup-name-line">
            <strong>{lead.name}</strong>
            <span className={`mini-status status-${statusClass(lead.status)}`}>{lead.status}</span>
          </div>
          <span className="followup-company">{lead.company || 'Sem empresa'} · {currency(lead.value)}</span>
          <div className="followup-action-line">
            <Target size={14} />
            <b>{lead.nextAction || 'Retornar contato'}</b>
          </div>
        </div>
      </button>

      <div className="followup-when">
        <span className={overdue ? 'danger-text' : ''}>{humanDate(lead.nextContact)}</span>
        <small><Clock3 size={13} /> {lead.nextContactTime || 'Sem horário'}</small>
      </div>

      <div className="followup-buttons">
        <select
          className="followup-status-select"
          value={lead.status}
          onChange={event => updateStatus(lead.id, event.target.value)}
          onClick={event => event.stopPropagation()}
          aria-label={`Atualizar status de ${lead.name}`}
          title="Atualizar status"
        >
          {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="followup-whatsapp" onClick={() => openWhatsApp(lead)} title="Abrir WhatsApp">
          <MessageCircle size={16} /><span>WhatsApp</span>
        </button>
        <button className="followup-reschedule" onClick={() => reschedule(lead)} title="Reagendar">
          <RefreshCw size={16} /><span>Reagendar</span>
        </button>
        <button className="followup-done" onClick={() => complete(lead.id)} title="Concluir follow-up">
          <Check size={17} /><span>Concluir</span>
        </button>
        <button className="followup-open" onClick={() => openLead(lead)} aria-label="Abrir lead"><ChevronRight size={18} /></button>
      </div>
    </article>
  );
}

function FollowUpSection({ title, subtitle, icon: Icon, tone, leads, ...actions }) {
  if (!leads.length) return null;
  return (
    <section className="followup-section">
      <div className="followup-section-head">
        <div className={`section-icon ${tone}`}><Icon size={17} /></div>
        <div><h2>{title}<span>{leads.length}</span></h2><p>{subtitle}</p></div>
      </div>
      <div className="followup-list">
        {leads.map(lead => <FollowUpCard key={lead.id} lead={lead} {...actions} />)}
      </div>
    </section>
  );
}

export default function FollowUps({ leads, setLeads, openLead, openWhatsApp, updateLeadStatus }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('Todos');
  const [rescheduling, setRescheduling] = useState(null);
  const [schedule, setSchedule] = useState({ date: '', time: '', action: '' });
  const [toast, setToast] = useState('');

  const allActive = useMemo(() => leads
    .filter(lead => lead.nextContact && !CLOSED.includes(lead.status))
    .sort((a, b) => `${a.nextContact}${a.nextContactTime || ''}`.localeCompare(`${b.nextContact}${b.nextContactTime || ''}`)), [leads]);

  const searchedActive = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allActive;
    return allActive.filter(lead => `${lead.name} ${lead.company} ${lead.nextAction} ${lead.status}`.toLowerCase().includes(needle));
  }, [allActive, query]);

  const groups = useMemo(() => groupByDate(allActive), [allActive]);
  const searchedGroups = useMemo(() => groupByDate(searchedActive), [searchedActive]);

  const visible = useMemo(() => {
    if (scope === 'Hoje') return { overdue: [], today: searchedGroups.today, week: [], later: [] };
    if (scope === 'Atrasados') return { overdue: searchedGroups.overdue, today: [], week: [], later: [] };
    if (scope === 'Próximos 7 dias') return { overdue: [], today: [], week: searchedGroups.week, later: [] };
    return searchedGroups;
  }, [searchedGroups, scope]);

  const totalPotential = [...groups.overdue, ...groups.today]
    .reduce((sum, lead) => sum + Number(lead.value || 0), 0);

  const showToast = text => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2300);
  };

  const updateStatus = (id, status) => {
    const lead = leads.find(item => item.id === id);
    if (updateLeadStatus) {
      updateLeadStatus(id, status);
      if (status === 'Vendido') showToast(`Confirme o valor final da venda de ${lead?.name || 'cliente'}.`);
      else showToast(`${lead?.name || 'Lead'} atualizado para ${status}.`);
      return;
    }
    setLeads(current => current.map(item => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    showToast(`${lead?.name || 'Lead'} atualizado para ${status}.`);
  };

  const complete = id => {
    const lead = leads.find(item => item.id === id);
    const now = new Date().toISOString();
    setLeads(current => current.map(item => item.id === id ? {
      ...item,
      nextContact: '',
      nextContactTime: '',
      nextAction: '',
      lastFollowupAt: now,
      updatedAt: now,
    } : item));
    showToast(`Follow-up de ${lead?.name || 'cliente'} concluído.`);
  };

  const openReschedule = lead => {
    setRescheduling(lead);
    setSchedule({
      date: lead.nextContact || todayKey(),
      time: lead.nextContactTime || '',
      action: lead.nextAction || 'Retornar contato',
    });
  };

  const quickReschedule = days => {
    const base = new Date();
    base.setDate(base.getDate() + days);
    const date = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    setSchedule(current => ({ ...current, date }));
  };

  const saveReschedule = event => {
    event.preventDefault();
    if (!rescheduling || !schedule.date) return;
    setLeads(current => current.map(item => item.id === rescheduling.id ? {
      ...item,
      nextContact: schedule.date,
      nextContactTime: schedule.time,
      nextAction: schedule.action,
      updatedAt: new Date().toISOString(),
    } : item));
    showToast(`${rescheduling.name} reagendado para ${fullDate(schedule.date)}.`);
    setRescheduling(null);
  };

  const empty = !visible.overdue.length && !visible.today.length && !visible.week.length && !visible.later.length;

  return (
    <main className="main-content followups-page">
      <header className="followups-header">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Sua fila de vendas</span>
          <h1>Follow-ups</h1>
          <p>Veja quem precisa de resposta e não deixe venda morrer por esquecimento.</p>
        </div>
        <label className="followups-search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente ou ação" /></label>
      </header>

      <section className="followup-summary">
        <article className="followup-stat critical"><div><AlertTriangle size={18} /></div><span>Atrasados<strong>{groups.overdue.length}</strong><small>precisam de atenção</small></span></article>
        <article className="followup-stat today"><div><CalendarClock size={18} /></div><span>Para hoje<strong>{groups.today.length}</strong><small>contatos programados</small></span></article>
        <article className="followup-stat upcoming"><div><Clock3 size={18} /></div><span>Próximos 7 dias<strong>{groups.week.length}</strong><small>na sua agenda</small></span></article>
        <article className="followup-stat money"><div><Target size={18} /></div><span>Em jogo hoje<strong>{currency(totalPotential)}</strong><small>pipeline vencido + hoje</small></span></article>
      </section>

      <div className="followup-toolbar">
        {['Todos', 'Hoje', 'Atrasados', 'Próximos 7 dias'].map(item => (
          <button key={item} className={scope === item ? 'active' : ''} onClick={() => setScope(item)}>{item}</button>
        ))}
      </div>

      <div className="followup-content">
        <FollowUpSection title="Atrasados" subtitle="Esses contatos já passaram da data. Resolva primeiro." icon={AlertTriangle} tone="red" leads={visible.overdue} openLead={openLead} openWhatsApp={openWhatsApp} complete={complete} reschedule={openReschedule} updateStatus={updateStatus} />
        <FollowUpSection title="Hoje" subtitle="Sua lista de contatos para resolver hoje." icon={CalendarClock} tone="green" leads={visible.today} openLead={openLead} openWhatsApp={openWhatsApp} complete={complete} reschedule={openReschedule} updateStatus={updateStatus} />
        <FollowUpSection title="Próximos 7 dias" subtitle="O que vem logo depois, sem surpresa na agenda." icon={Clock3} tone="blue" leads={visible.week} openLead={openLead} openWhatsApp={openWhatsApp} complete={complete} reschedule={openReschedule} updateStatus={updateStatus} />
        <FollowUpSection title="Mais adiante" subtitle="Follow-ups já programados para depois desta semana." icon={CalendarClock} tone="gray" leads={visible.later} openLead={openLead} openWhatsApp={openWhatsApp} complete={complete} reschedule={openReschedule} updateStatus={updateStatus} />

        {empty && (
          <section className="followup-empty">
            <div><Check size={24} /></div>
            <h2>Nada pendente por aqui.</h2>
            <p>{query ? 'Nenhum follow-up corresponde à sua busca.' : 'Sua fila está limpa. Aproveita antes que os clientes inventem mais trabalho.'}</p>
          </section>
        )}
      </div>

      {rescheduling && (
        <div className="modal-backdrop" onMouseDown={() => setRescheduling(null)}>
          <section className="modal reschedule-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div><h2>Reagendar follow-up</h2><p>{rescheduling.name} · {rescheduling.company || 'Sem empresa'}</p></div>
              <button className="icon-button" onClick={() => setRescheduling(null)}><X size={20} /></button>
            </div>
            <div className="quick-dates">
              <span>Atalhos</span>
              <button onClick={() => quickReschedule(1)}>Amanhã</button>
              <button onClick={() => quickReschedule(3)}>+3 dias</button>
              <button onClick={() => quickReschedule(7)}>+7 dias</button>
            </div>
            <form className="lead-form" onSubmit={saveReschedule}>
              <label><span>Data *</span><input type="date" min={todayKey()} value={schedule.date} onChange={e => setSchedule({ ...schedule, date: e.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={schedule.time} onChange={e => setSchedule({ ...schedule, time: e.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={schedule.action} onChange={e => setSchedule({ ...schedule, action: e.target.value })} placeholder="Ex.: Cobrar retorno da proposta" /></label>
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => setRescheduling(null)}>Cancelar</button><button className="primary-button"><RefreshCw size={16} /> Reagendar</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="followup-toast"><Check size={16} /> {toast}</div>}
    </main>
  );
}
