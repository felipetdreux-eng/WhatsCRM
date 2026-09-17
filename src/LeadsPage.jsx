import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileSpreadsheet,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Snowflake,
  Sparkles,
  Target,
  UsersRound,
  X,
} from 'lucide-react';
import LeadImporter from './LeadImporter';
import { buildCoolingWatchlist, getLeadTemperature } from './leadTemperature';
import { buildSmartLeadList, getLeadIntelligence } from './leadIntelligence';
import { buildDuplicateIndex, duplicateGroupCount } from './duplicateLeads';
import './leads.css';

const CLOSED = ['Fechado', 'Perdido'];
const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'];
const SCOPES = ['Todos', 'Inteligentes', 'Duplicados', 'Hoje', 'Atrasados', 'Próx. 7 dias', 'Sem próximo contato', 'Esfriando'];
const LEADS_FILTERS_STORAGE_KEY = 'fuply-leads-filters';
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const noon = value => new Date(`${value}T12:00:00`);
const diff = value => value ? Math.round((noon(value) - noon(today())) / 86400000) : null;
const pretty = value => {
  if (!value) return 'Sem próximo contato';
  const days = diff(value);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  if (days < -1) return `${Math.abs(days)} dias atrás`;
  return noon(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};
const full = value => noon(value).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');

function readPersistedFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEADS_FILTERS_STORAGE_KEY) || '{}');
    return {
      query: typeof saved.query === 'string' ? saved.query : '',
      status: saved.status === 'Todos' || STATUSES.includes(saved.status) ? saved.status : 'Todos',
      scope: SCOPES.includes(saved.scope) ? saved.scope : 'Todos',
      assignee: typeof saved.assignee === 'string' && saved.assignee ? saved.assignee : 'Todos',
    };
  } catch {
    return { query: '', status: 'Todos', scope: 'Todos', assignee: 'Todos' };
  }
}

function TemperatureBadge({ lead }) {
  const temperature = getLeadTemperature(lead);
  if (!temperature) return null;
  return <span className={`lead-temperature-mini ${temperature.level}`} title={`${temperature.reason}. ${temperature.detail}`}>{temperature.label}</span>;
}

function SmartBadge({ lead }) {
  const intelligence = getLeadIntelligence(lead);
  if (!intelligence) return null;
  const title = `${intelligence.label} · ${intelligence.score}/100 · ${intelligence.reasons.join(' · ')} · Próxima ação: ${intelligence.recommendedAction}`;
  return <span className={`lead-smart-mini ${intelligence.level}`} title={title}><Sparkles size={11} /> {intelligence.score} · {intelligence.label}</span>;
}

function DuplicateBadge({ lead, duplicateIndex }) {
  const duplicate = duplicateIndex.get(lead.id);
  if (!duplicate) return null;
  const top = duplicate.matches[0];
  const extra = duplicate.matches.length > 1 ? ` +${duplicate.matches.length - 1}` : '';
  const title = duplicate.matches.map(match => `${match.name}: ${match.reason} (${match.confidence}%)`).join(' · ');
  return <span className="lead-duplicate-mini" title={title}><Copy size={11} /> Possível duplicado: {top?.name || 'outro lead'}{extra}</span>;
}

function inScope(lead, scope, duplicateIndex) {
  if (scope === 'Todos') return true;
  if (scope === 'Inteligentes') return Boolean(getLeadIntelligence(lead));
  if (scope === 'Duplicados') return duplicateIndex.has(lead.id);
  const closed = CLOSED.includes(lead.status);
  if (scope === 'Esfriando') return Boolean(getLeadTemperature(lead)?.atRisk);
  const days = diff(lead.nextContact);
  if (scope === 'Sem próximo contato') return !lead.nextContact && !closed;
  if (closed || !lead.nextContact) return false;
  if (scope === 'Hoje') return days === 0;
  if (scope === 'Atrasados') return days < 0;
  if (scope === 'Próx. 7 dias') return days > 0 && days <= 7;
  return true;
}

export default function LeadsPage({ leads, setLeads, openLead, openWhatsApp, onNewLead, updateLeadStatus, onActivity, preset, memberName, teamMembers = [] }) {
  const [query, setQuery] = useState(() => readPersistedFilters().query);
  const [status, setStatus] = useState(() => readPersistedFilters().status);
  const [scope, setScope] = useState(() => readPersistedFilters().scope);
  const [assigneeFilter, setAssigneeFilter] = useState(() => readPersistedFilters().assignee || 'Todos');
  const [rescheduling, setRescheduling] = useState(null);
  const [schedule, setSchedule] = useState({ date: '', time: '', action: '' });
  const [toast, setToast] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('fuply-leads-view') || 'simple');
  const duplicateIndex = useMemo(() => buildDuplicateIndex(leads), [leads]);
  const duplicateGroups = useMemo(() => duplicateGroupCount(duplicateIndex), [duplicateIndex]);
  const assigneeName = lead => memberName?.(lead.assignedTo) || (lead.assignedTo ? 'Responsável' : 'Sem responsável');

  useEffect(() => {
    localStorage.setItem(LEADS_FILTERS_STORAGE_KEY, JSON.stringify({ query, status, scope, assignee: assigneeFilter }));
  }, [query, status, scope, assigneeFilter]);

  useEffect(() => {
    if (!preset) return;
    setQuery('');
    setStatus(preset.status || 'Todos');
    setScope(preset.scope || 'Todos');
    setAssigneeFilter(preset.assignee || 'Todos');
  }, [preset?.nonce]);

  const changeViewMode = mode => {
    setViewMode(mode);
    localStorage.setItem('fuply-leads-view', mode);
  };

  const summary = useMemo(() => {
    const active = leads.filter(lead => !CLOSED.includes(lead.status));
    const dated = active.filter(lead => lead.nextContact);
    return {
      overdue: dated.filter(lead => diff(lead.nextContact) < 0),
      today: dated.filter(lead => diff(lead.nextContact) === 0),
      week: dated.filter(lead => diff(lead.nextContact) > 0 && diff(lead.nextContact) <= 7),
      without: active.filter(lead => !lead.nextContact),
      cooling: buildCoolingWatchlist(active, { limit: Math.max(1, active.length) }),
      smart: buildSmartLeadList(active, { limit: Math.max(1, active.length), minScore: 60 }),
    };
  }, [leads]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(item => [item, leads.filter(lead => lead.status === item).length])), [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter(lead => !q || `${lead.name} ${lead.company} ${lead.phone} ${lead.origin} ${lead.status} ${lead.nextAction} ${lead.notes || ''} ${assigneeName(lead)}`.toLowerCase().includes(q))
      .filter(lead => status === 'Todos' || lead.status === status)
      .filter(lead => assigneeFilter === 'Todos' || (assigneeFilter === 'Sem responsável' ? !lead.assignedTo : lead.assignedTo === assigneeFilter))
      .filter(lead => !preset?.origin || lead.origin === preset.origin)
      .filter(lead => !preset?.assignee || lead.assignedTo === preset.assignee)
      .filter(lead => inScope(lead, scope, duplicateIndex))
      .sort((a, b) => {
        if (scope === 'Duplicados') {
          const aDuplicate = duplicateIndex.get(a.id);
          const bDuplicate = duplicateIndex.get(b.id);
          return (bDuplicate?.highestConfidence || 0) - (aDuplicate?.highestConfidence || 0);
        }
        if (scope === 'Inteligentes') {
          const aSmart = getLeadIntelligence(a);
          const bSmart = getLeadIntelligence(b);
          if ((aSmart?.score || 0) !== (bSmart?.score || 0)) return (bSmart?.score || 0) - (aSmart?.score || 0);
          return Number(b.value || 0) - Number(a.value || 0);
        }
        if (scope === 'Esfriando') {
          const aTemperature = getLeadTemperature(a);
          const bTemperature = getLeadTemperature(b);
          const aRank = aTemperature?.level === 'cooling' ? 0 : 1;
          const bRank = bTemperature?.level === 'cooling' ? 0 : 1;
          if (aRank !== bRank) return aRank - bRank;
          if ((aTemperature?.days || 0) !== (bTemperature?.days || 0)) return (bTemperature?.days || 0) - (aTemperature?.days || 0);
        }
        return a.nextContact && b.nextContact
          ? `${a.nextContact}${a.nextContactTime || ''}`.localeCompare(`${b.nextContact}${b.nextContactTime || ''}`)
          : a.nextContact ? -1 : b.nextContact ? 1 : String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
  }, [leads, query, status, scope, assigneeFilter, duplicateIndex, preset?.origin, preset?.assignee, memberName]);

  const flash = text => {
    setToast(text);
    window.setTimeout(() => setToast(''), 3200);
  };

  const changeStatus = (lead, next) => {
    if (lead.status === next) return;
    updateLeadStatus?.(lead.id, next);
    flash(next === 'Fechado' ? `Confirme o valor final da venda de ${lead.name}.` : `${lead.name} atualizado para ${next}.`);
  };

  const complete = lead => {
    const now = new Date().toISOString();
    const previousDate = lead.nextContact;
    const previousAction = lead.nextAction || 'Retornar contato';
    setLeads(current => current.map(item => item.id === lead.id ? {
      ...item,
      nextContact: '',
      nextContactTime: '',
      nextAction: '',
      lastFollowupAt: now,
      updatedAt: now,
    } : item));
    onActivity?.(
      lead,
      'followup_completed',
      'Follow-up concluído',
      previousDate ? `${previousAction} · estava marcado para ${full(previousDate)}.` : previousAction,
      { previousDate, previousAction },
    );
    flash(`Follow-up de ${lead.name} concluído. O lead continua salvo.`);
  };

  const openReschedule = lead => {
    setRescheduling(lead);
    setSchedule({ date: lead.nextContact || today(), time: lead.nextContactTime || '', action: lead.nextAction || 'Retornar contato' });
  };

  const markFor = (lead, days) => {
    if (!lead || CLOSED.includes(lead.status)) return;
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    const nextContact = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const action = lead.nextAction || 'Retornar contato';
    const now = new Date().toISOString();
    setLeads(current => current.map(item => item.id === lead.id ? {
      ...item,
      nextContact,
      nextAction: action,
      updatedAt: now,
    } : item));
    onActivity?.(
      lead,
      'followup_scheduled',
      lead.nextContact ? 'Follow-up reagendado' : 'Follow-up marcado',
      `${full(nextContact)} · ${action}`,
      { date: nextContact, time: lead.nextContactTime || '', action },
    );
    flash(`${lead.name} marcado para ${pretty(nextContact).toLowerCase()}.`);
  };

  const handleMarkFor = (event, lead) => {
    const value = event.target.value;
    if (!value) return;
    if (value === 'custom') {
      openReschedule(lead);
      return;
    }
    markFor(lead, Number(value));
  };

  const quick = days => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    setSchedule(current => ({ ...current, date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }));
  };

  const save = event => {
    event.preventDefault();
    if (!rescheduling || !schedule.date) return;
    const action = schedule.action.trim() || 'Retornar contato';
    const now = new Date().toISOString();
    setLeads(current => current.map(lead => lead.id === rescheduling.id ? {
      ...lead,
      nextContact: schedule.date,
      nextContactTime: schedule.time,
      nextAction: action,
      updatedAt: now,
    } : lead));
    onActivity?.(
      rescheduling,
      'followup_scheduled',
      rescheduling.nextContact ? 'Follow-up reagendado' : 'Follow-up agendado',
      `${full(schedule.date)}${schedule.time ? ` às ${schedule.time}` : ''} · ${action}`,
      { date: schedule.date, time: schedule.time, action },
    );
    flash(`${rescheduling.name} reagendado para ${full(schedule.date)}.`);
    setRescheduling(null);
  };

  const importDone = stats => {
    const pieces = [];
    if (stats.create) pieces.push(`${stats.create} novo${stats.create === 1 ? '' : 's'}`);
    if (stats.update) pieces.push(`${stats.update} atualizado${stats.update === 1 ? '' : 's'}`);
    if (stats.errors) pieces.push(`${stats.errors} linha${stats.errors === 1 ? '' : 's'} ignorada${stats.errors === 1 ? '' : 's'}`);
    flash(`Importação concluída: ${pieces.join(', ') || 'nenhuma alteração'}.`);
  };

  const updateInlineValue = (lead, rawValue) => {
    const value = Math.max(0, Number(rawValue || 0));
    if (!Number.isFinite(value) || value === Number(lead.value || 0)) return;
    const now = new Date().toISOString();
    setLeads(current => current.map(item => item.id === lead.id ? { ...item, value, updatedAt: now } : item));
    onActivity?.(lead, 'lead_updated', 'Valor potencial atualizado', `${money(lead.value)} → ${money(value)}.`, { from: Number(lead.value || 0), to: value });
    flash(`${lead.name}: valor potencial atualizado.`);
  };

  const updateInlineAction = (lead, rawAction) => {
    const action = rawAction.trim();
    if (action === (lead.nextAction || '')) return;
    const now = new Date().toISOString();
    setLeads(current => current.map(item => item.id === lead.id ? { ...item, nextAction: action, updatedAt: now } : item));
    onActivity?.(lead, 'lead_updated', 'Próxima ação atualizada', action || 'Próxima ação removida.');
    flash(`${lead.name}: próxima ação atualizada.`);
  };

  return (
    <main className={`main-content leads-page ${viewMode === 'simple' ? 'leads-simple-mode' : 'leads-complete-mode'}`}>
      <header className="leads-header">
        <div><span className="leads-kicker"><UsersRound size={14} /> Base de clientes</span><h1>Leads inteligentes</h1><p>Prioridade automática para você atacar primeiro quem tem mais chance e mais valor.</p></div>
        <div className="leads-header-actions">
          <div className="view-mode-toggle" aria-label="Modo de visualização"><button type="button" className={viewMode === 'simple' ? 'active' : ''} onClick={() => changeViewMode('simple')}>Simples</button><button type="button" className={viewMode === 'complete' ? 'active' : ''} onClick={() => changeViewMode('complete')}>Completo</button></div>
          <button type="button" className="secondary-button leads-import-button" onClick={() => setImportOpen(true)}><FileSpreadsheet size={17} /> Importar planilha</button>
          <button type="button" className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="leads-summary">
        <button type="button" className={`smart ${scope === 'Inteligentes' ? 'active' : ''}`} onClick={() => setScope(scope === 'Inteligentes' ? 'Todos' : 'Inteligentes')}><Sparkles size={18} /><span>Prioridade alta<strong>{summary.smart.length}</strong></span></button>
        <button type="button" className={`duplicate ${scope === 'Duplicados' ? 'active' : ''}`} onClick={() => setScope(scope === 'Duplicados' ? 'Todos' : 'Duplicados')}><Copy size={18} /><span>Grupos duplicados<strong>{duplicateGroups}</strong></span></button>
        <button type="button" className={`critical ${scope === 'Atrasados' ? 'active' : ''}`} onClick={() => setScope(scope === 'Atrasados' ? 'Todos' : 'Atrasados')}><AlertTriangle size={18} /><span>Atrasados<strong>{summary.overdue.length}</strong></span></button>
        <button type="button" className={`today ${scope === 'Hoje' ? 'active' : ''}`} onClick={() => setScope(scope === 'Hoje' ? 'Todos' : 'Hoje')}><CalendarClock size={18} /><span>Para hoje<strong>{summary.today.length}</strong></span></button>
        <button type="button" className={`upcoming ${scope === 'Próx. 7 dias' ? 'active' : ''}`} onClick={() => setScope(scope === 'Próx. 7 dias' ? 'Todos' : 'Próx. 7 dias')}><Clock3 size={18} /><span>Próx. 7 dias<strong>{summary.week.length}</strong></span></button>
        <button type="button" className={`missing ${scope === 'Sem próximo contato' ? 'active' : ''}`} onClick={() => setScope(scope === 'Sem próximo contato' ? 'Todos' : 'Sem próximo contato')}><Target size={18} /><span>Sem próximo contato<strong>{summary.without.length}</strong></span></button>
        <button type="button" className={`cooling ${scope === 'Esfriando' ? 'active' : ''}`} onClick={() => setScope(scope === 'Esfriando' ? 'Todos' : 'Esfriando')}><Snowflake size={18} /><span>Esfriando<strong>{summary.cooling.length}</strong></span></button>
      </section>

      <section className="leads-directory">
        <div className="leads-directory-top">
          <label className="leads-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, empresa, WhatsApp, observação ou ação" aria-label="Buscar leads" /></label>
          <label className={`leads-assignee-filter ${assigneeFilter !== 'Todos' ? 'active' : ''}`}><UsersRound size={16} /><select value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} aria-label="Filtrar por responsável"><option value="Todos">Todos os responsáveis</option>{teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}<option value="Sem responsável">Sem responsável</option></select></label>
          <span className="leads-result-count">{filtered.length} de {leads.length} leads</span>
        </div>
        <div className="leads-scope-tabs">{SCOPES.map(item => <button type="button" key={item} className={scope === item ? 'active' : ''} onClick={() => setScope(item)}>{item}</button>)}</div>
        <div className="leads-status-tabs"><button type="button" className={status === 'Todos' ? 'active' : ''} onClick={() => setStatus('Todos')}>Todos <b>{leads.length}</b></button>{STATUSES.map(item => <button type="button" key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)}>{item} <b>{counts[item]}</b></button>)}</div>

        <div className="leads-desktop-table-wrap">
          <table className="leads-table">
            <thead><tr><th>Lead</th><th>Status</th><th>Origem</th><th>Responsável</th><th>Valor</th><th>Inteligência</th><th>Próximo contato</th><th>Próxima ação</th><th>Ações</th></tr></thead>
            <tbody>{filtered.map(lead => (
              <tr key={lead.id} tabIndex={0} onClick={() => openLead(lead)} onKeyDown={event => { if (event.key === 'Enter') openLead(lead); }}>
                <td><div className="lead-contact-cell"><div className="leads-avatar">{lead.name.slice(0, 2).toUpperCase()}</div><div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span><TemperatureBadge lead={lead} /><DuplicateBadge lead={lead} duplicateIndex={duplicateIndex} /></div></div></td>
                <td onClick={event => event.stopPropagation()}><select className="leads-status-select" value={lead.status} onChange={event => changeStatus(lead, event.target.value)} aria-label={`Status de ${lead.name}`}>{STATUSES.map(item => <option key={item}>{item}</option>)}</select></td>
                <td><span className="lead-origin">{lead.origin || 'Outro'}</span></td>
                <td><span className="leads-next"><UsersRound size={14} />{assigneeName(lead)}</span></td>
                <td onClick={event => event.stopPropagation()}>{lead.status === 'Fechado' ? <strong className="leads-value">{money(lead.saleValue)}</strong> : <input className="inline-value-input" type="number" min="0" step="0.01" defaultValue={Number(lead.value || 0)} onBlur={event => updateInlineValue(lead, event.target.value)} aria-label={`Valor potencial de ${lead.name}`} />}</td>
                <td><SmartBadge lead={lead} /></td>
                <td><span className={`leads-next ${lead.nextContact ? '' : 'muted'} ${diff(lead.nextContact) < 0 ? 'overdue' : ''}`}><CalendarClock size={14} />{pretty(lead.nextContact)}{lead.nextContactTime ? ` · ${lead.nextContactTime}` : ''}</span></td>
                <td onClick={event => event.stopPropagation()}><input className="inline-next-action-input" defaultValue={lead.nextAction || ''} placeholder="Definir ação" onBlur={event => updateInlineAction(lead, event.target.value)} aria-label={`Próxima ação de ${lead.name}`} /></td>
                <td onClick={event => event.stopPropagation()}><div className="lead-row-actions">
                  <button type="button" className="leads-whatsapp" onClick={() => openWhatsApp(lead)} title="Abrir WhatsApp" aria-label={`Abrir WhatsApp de ${lead.name}`}><MessageCircle size={15} /></button>
                  {!CLOSED.includes(lead.status) && <select className="lead-mark-for" value="" onChange={event => handleMarkFor(event, lead)} aria-label={`Marcar ${lead.name} para uma data`}>
                    <option value="" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : 'Marcar para'}</option>
                    <option value="0">Hoje</option>
                    <option value="1">Amanhã</option>
                    <option value="3">+3 dias</option>
                    <option value="7">+7 dias</option>
                    <option value="custom">Escolher data…</option>
                  </select>}
                  {lead.nextContact && !CLOSED.includes(lead.status) && <button type="button" className="lead-mini-action done" onClick={() => complete(lead)} title="Concluir follow-up" aria-label={`Concluir follow-up de ${lead.name}`}><Check size={15} /></button>}
                  <button type="button" className="lead-open-button" onClick={() => openLead(lead)} aria-label={`Abrir ${lead.name}`}><ChevronRight size={16} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div className="leads-mobile-list">{filtered.map(lead => (
          <article className="lead-directory-card" key={lead.id}>
            <div className="lead-directory-card-top"><div className="lead-contact-cell"><div className="leads-avatar">{lead.name.slice(0, 2).toUpperCase()}</div><div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span></div></div><div className="lead-mobile-badges"><span className={`leads-status status-${statusClass(lead.status)}`}>{lead.status}</span><TemperatureBadge lead={lead} /><SmartBadge lead={lead} /><DuplicateBadge lead={lead} duplicateIndex={duplicateIndex} /></div></div>
            <div className="lead-directory-card-meta"><span><UsersRound size={14} />{assigneeName(lead)}</span><span><CalendarClock size={14} />{pretty(lead.nextContact)}</span><span><Target size={14} />{lead.nextAction || 'Sem próxima ação'}</span></div>
            <div className="lead-directory-card-bottom"><strong>{money(lead.status === 'Fechado' ? lead.saleValue : lead.value)}</strong><div>
              <button type="button" className="mobile-whatsapp" onClick={() => openWhatsApp(lead)} aria-label={`Abrir WhatsApp de ${lead.name}`}><MessageCircle size={15} /></button>
              {!CLOSED.includes(lead.status) && <select className="lead-mark-for mobile-mark-for" value="" onChange={event => handleMarkFor(event, lead)} aria-label={`Marcar ${lead.name} para uma data`}>
                <option value="" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : 'Marcar para'}</option>
                <option value="0">Hoje</option>
                <option value="1">Amanhã</option>
                <option value="3">+3 dias</option>
                <option value="7">+7 dias</option>
                <option value="custom">Escolher data…</option>
              </select>}
              {lead.nextContact && !CLOSED.includes(lead.status) && <button type="button" className="mobile-open" onClick={() => complete(lead)} aria-label={`Concluir follow-up de ${lead.name}`}><Check size={15} /></button>}
              <button type="button" className="mobile-open" onClick={() => openLead(lead)} aria-label={`Abrir ${lead.name}`}><ChevronRight size={15} /></button>
            </div></div>
          </article>
        ))}</div>

        {!filtered.length && <div className="leads-empty"><UsersRound size={30} /><h2>Nenhum lead encontrado</h2><p>Ajuste os filtros ou adicione um novo contato.</p></div>}
      </section>

      {rescheduling && (
        <div className="modal-backdrop" onMouseDown={() => setRescheduling(null)}>
          <section className="modal reschedule-modal" role="dialog" aria-modal="true" aria-labelledby="reschedule-title" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header"><div><h2 id="reschedule-title">Marcar para</h2><p>{rescheduling.name} · {rescheduling.company || 'Sem empresa'}</p></div><button type="button" className="icon-button" onClick={() => setRescheduling(null)} aria-label="Fechar"><X size={20} /></button></div>
            <div className="quick-dates"><span>Atalhos</span><button type="button" onClick={() => quick(0)}>Hoje</button><button type="button" onClick={() => quick(1)}>Amanhã</button><button type="button" onClick={() => quick(3)}>+3 dias</button><button type="button" onClick={() => quick(7)}>+7 dias</button></div>
            <form className="lead-form" onSubmit={save}>
              <label><span>Data *</span><input required type="date" min={today()} value={schedule.date} onChange={event => setSchedule({ ...schedule, date: event.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={schedule.time} onChange={event => setSchedule({ ...schedule, time: event.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={schedule.action} onChange={event => setSchedule({ ...schedule, action: event.target.value })} /></label>
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => setRescheduling(null)}>Cancelar</button><button className="primary-button"><CalendarClock size={16} /> Salvar marcação</button></div>
            </form>
          </section>
        </div>
      )}

      {importOpen && <LeadImporter leads={leads} setLeads={setLeads} onClose={() => setImportOpen(false)} onActivity={onActivity} onDone={importDone} />}
      {toast && <div className="leads-toast" role="status"><Check size={16} />{toast}</div>}
    </main>
  );
}
