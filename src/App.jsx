import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  LayoutDashboard,
  ListFilter,
  LogOut,
  MapPin,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Settings,
  Target,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import Dashboard from './Dashboard';
import FollowUps from './FollowUps';
import LeadHistory from './LeadHistory';
import Messages from './Messages';
import SettingsPage from './SettingsPage';
import { getActiveAccount, logoutAccount } from './accountStorage';
import { loadWorkspaceContext, recordLeadActivity, syncLeads } from './backendBridge';
import {
  buildDemoLeads,
  canonicalPhone,
  currency,
  dateKeyOffset,
  localDateKey,
  validBrazilPhone,
  whatsappPhone,
} from './domain';
import './styles.css';
import './detail.css';
import './account.css';
import './followup.css';
import './team-leads.css';

const ACTIVE_ACCOUNT = getActiveAccount();
const CLOSED = ['Fechado', 'Perdido'];
const GOAL_LABELS = {
  organize: 'Organizar leads',
  followups: 'Follow-ups',
  sales: 'Aumentar vendas',
};

const STATUSES = [
  { id: 'Novo lead', className: 'new' },
  { id: 'Contatado', className: 'contacted' },
  { id: 'Interessado', className: 'interested' },
  { id: 'Proposta enviada', className: 'proposal' },
  { id: 'Negociação', className: 'negotiation' },
  { id: 'Fechado', className: 'sold' },
  { id: 'Perdido', className: 'lost' },
];

const OPEN_STATUSES = STATUSES.filter(status => !CLOSED.includes(status.id));
const ORIGINS = ['Google Maps', 'Instagram', 'Indicação', 'Site', 'WhatsApp', 'Outro'];
const NAV_ITEMS = [
  ['Dashboard', LayoutDashboard],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];

const EMPTY_FORM = {
  name: '', company: '', phone: '', value: '', status: 'Novo lead', origin: 'Google Maps', assignedTo: '',
  nextContact: '', nextContactTime: '', nextAction: '', notes: '',
};

function initials(name) {
  const parts = String(name || 'Usuário').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) || 'US').toUpperCase();
}

function formatDate(value, long = false) {
  if (!value) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (!long && date.toDateString() === today.toDateString()) return 'Hoje';
  if (!long && date.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return date.toLocaleDateString('pt-BR', long
    ? { day: '2-digit', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: '2-digit' });
}

function statusTone(status) {
  if (status === 'Contatado') return 'blue';
  if (status === 'Interessado') return 'purple';
  if (status === 'Proposta enviada') return 'red';
  if (status === 'Negociação') return 'purple';
  if (status === 'Fechado') return 'green';
  if (status === 'Perdido') return 'red';
  return 'neutral';
}

function migrateLead(rawLead) {
  const lead = rawLead && typeof rawLead === 'object' ? rawLead : {};
  const rawStatus = lead.status === "Vendido" ? 'Fechado' : lead.status;
  const status = STATUSES.some(item => item.id === rawStatus) ? rawStatus : 'Novo lead';
  const value = Number.isFinite(Number(lead.value)) ? Number(lead.value) : 0;
  const hadSaleValue = Number.isFinite(Number(lead.saleValue)) && Number(lead.saleValue) > 0;
  const assumedSaleValue = status === 'Fechado' && !hadSaleValue && value > 0;
  const migrated = {
    ...lead,
    id: lead.id || crypto.randomUUID(),
    name: String(lead.name || 'Lead sem nome'),
    company: String(lead.company || ''),
    phone: canonicalPhone(lead.phone),
    value,
    status,
    origin: lead.origin || 'Outro',
    assignedTo: lead.assignedTo || null,
    nextContact: lead.nextContact || '',
    nextContactTime: lead.nextContactTime || '',
    nextAction: lead.nextAction || '',
    notes: lead.notes || '',
    lastFollowupAt: lead.lastFollowupAt || null,
    createdAt: lead.createdAt || null,
    updatedAt: lead.updatedAt || lead.soldAt || lead.lostAt || lead.createdAt || null,
    soldAt: status === 'Fechado' ? (lead.soldAt || null) : null,
    lostAt: status === 'Perdido' ? (lead.lostAt || null) : null,
    saleValue: status === 'Fechado' ? (hadSaleValue ? Number(lead.saleValue) : (value > 0 ? value : null)) : null,
    saleValueSource: status === 'Fechado'
      ? (hadSaleValue ? (lead.saleValueSource || 'confirmed') : (assumedSaleValue ? 'legacy-potential' : 'missing'))
      : null,
  };

  if (CLOSED.includes(status)) {
    migrated.nextContact = '';
    migrated.nextContactTime = '';
    migrated.nextAction = '';
  }
  return migrated;
}

function migrateLeads(items) {
  return (Array.isArray(items) ? items : []).map(migrateLead);
}

function applyStatusTransition(previous, draft, nextStatus, saleValue) {
  const now = new Date().toISOString();
  const changed = previous.status !== nextStatus;
  const next = { ...previous, ...draft, status: nextStatus, updatedAt: now };

  if (nextStatus === 'Fechado') {
    next.saleValue = Number(saleValue ?? draft.saleValue ?? previous.saleValue ?? 0);
    next.saleValueSource = 'confirmed';
    next.soldAt = previous.status === 'Fechado' && previous.soldAt ? previous.soldAt : now;
    next.lostAt = null;
    next.nextContact = '';
    next.nextContactTime = '';
    next.nextAction = '';
  } else if (nextStatus === 'Perdido') {
    next.saleValue = null;
    next.saleValueSource = null;
    next.soldAt = null;
    next.lostAt = previous.status === 'Perdido' && previous.lostAt ? previous.lostAt : now;
    next.nextContact = '';
    next.nextContactTime = '';
    next.nextAction = '';
  } else if (changed && CLOSED.includes(previous.status)) {
    next.saleValue = null;
    next.saleValueSource = null;
    next.soldAt = null;
    next.lostAt = null;
  }
  return next;
}

function interactionTemperature(lead) {
  if (!lead || CLOSED.includes(lead.status)) return null;
  const source = lead.lastFollowupAt || lead.updatedAt || lead.createdAt;
  if (!source) return { tone: 'cooling', text: 'Sem interação registrada' };
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days <= 1) return { tone: 'hot', text: days === 0 ? 'Interação hoje' : 'Interação ontem' };
  if (days <= 4) return { tone: 'cooling', text: `${days} dias sem interação` };
  return { tone: 'cold', text: `${days} dias sem interação` };
}

export default function App() {
  const [account, setAccount] = useState(ACTIVE_ACCOUNT);
  const [leads, setLeads] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('zapflow-leads'));
      return migrateLeads(Array.isArray(saved) ? saved : buildDemoLeads());
    } catch {
      return migrateLeads(buildDemoLeads());
    }
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [originFilter, setOriginFilter] = useState('Todas');
  const [assigneeFilter, setAssigneeFilter] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [activePage, setActivePage] = useState('Dashboard');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [pendingSale, setPendingSale] = useState(null);
  const [saleError, setSaleError] = useState('');
  const [pendingFollowup, setPendingFollowup] = useState(null);
  const [followupForm, setFollowupForm] = useState({ date: '', time: '', action: 'Retornar contato' });
  const [followupError, setFollowupError] = useState('');

  useEffect(() => {
    localStorage.setItem('zapflow-leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    const handleRemoteLeads = event => {
      const freshLeads = event?.detail?.leads;
      if (!Array.isArray(freshLeads)) return;
      setLeads(migrateLeads(freshLeads));
    };
    window.addEventListener('zapflow:remote-leads', handleRemoteLeads);
    return () => window.removeEventListener('zapflow:remote-leads', handleRemoteLeads);
  }, []);

  useEffect(() => {
    let active = true;
    if (!account?.id) return undefined;
    loadWorkspaceContext(account.id)
      .then(context => {
        if (!active) return;
        setTeamMembers(context?.members || []);
      })
      .catch(error => console.error('Team members load failed:', error));
    return () => { active = false; };
  }, [account?.id]);

  const selectedLead = leads.find(lead => lead.id === selectedLeadId) || null;
  const accountName = account?.name || 'Usuário';
  const accountGoal = GOAL_LABELS[account?.onboarding?.goal] || 'Plano gratuito';
  const memberName = userId => teamMembers.find(member => member.user_id === userId)?.name || (userId === account?.id ? accountName : 'Sem responsável');

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const haystack = `${lead.name} ${lead.company} ${lead.phone} ${lead.origin} ${lead.status} ${lead.notes || ''} ${lead.nextAction || ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase())
      && (statusFilter === 'Todos' || lead.status === statusFilter)
      && (originFilter === 'Todas' || lead.origin === originFilter)
      && (assigneeFilter === 'Todos' || lead.assignedTo === assigneeFilter);
  }), [leads, query, statusFilter, originFilter, assigneeFilter]);

  const dueFollowups = leads.filter(lead => lead.nextContact && !CLOSED.includes(lead.status) && lead.nextContact <= localDateKey()).length;

  const metrics = STATUSES.map(status => {
    const items = filteredLeads.filter(lead => lead.status === status.id);
    const amount = items.reduce((sum, lead) => sum + Number(status.id === 'Fechado' ? lead.saleValue || 0 : lead.value || 0), 0);
    return {
      label: status.id,
      value: items.length,
      helper: status.id === 'Fechado' ? `${currency(amount)} fechados` : `${currency(amount)} em valor`,
      icon: status.id === 'Fechado' ? CheckCircle2 : status.id === 'Perdido' ? XCircle : Target,
      tone: statusTone(status.id),
    };
  });

  const emitActivityRefresh = leadId => {
    window.dispatchEvent(new CustomEvent('zapflow:activity-recorded', { detail: { leadId } }));
  };

  const logActivity = async (lead, kind, title, detail = '', metadata = {}) => {
    if (!account?.id || !lead?.id) return;
    try {
      const item = await recordLeadActivity({ userId: account.id, leadId: lead.id, kind, title, detail, metadata });
      if (item) emitActivityRefresh(lead.id);
    } catch (activityError) {
      console.error('Lead activity save failed:', activityError);
    }
  };

  const isDuplicatePhone = (phone, exceptId = null) => {
    const canonical = canonicalPhone(phone);
    return leads.some(lead => lead.id !== exceptId && canonicalPhone(lead.phone) === canonical);
  };

  const openNewLead = (status = 'Novo lead') => {
    setForm({ ...EMPTY_FORM, status: OPEN_STATUSES.some(item => item.id === status) ? status : 'Novo lead', assignedTo: account?.id || '' });
    setFormError('');
    setModalOpen(true);
  };

  const openWhatsApp = (lead, message = '', options = {}) => {
    const phone = whatsappPhone(lead?.phone);
    if (!phone) return false;
    const currentLead = leads.find(item => item.id === lead.id) || lead;
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    window.open(`https://wa.me/${phone}${text}`, '_blank', 'noopener,noreferrer');

    const now = new Date().toISOString();
    setLeads(current => current.map(item => item.id === currentLead.id
      ? { ...item, lastFollowupAt: now, updatedAt: now }
      : item));
    logActivity(
      currentLead,
      'whatsapp_opened',
      'WhatsApp aberto',
      message ? 'Conversa aberta com uma mensagem preparada pelo sistema.' : 'Conversa aberta pelo sistema. O envio da mensagem não é confirmado pelo WhatsApp.',
      { hasMessage: Boolean(message), source: options?.source || 'app' },
    );

    if (!options?.skipFollowupPrompt && !CLOSED.includes(currentLead.status)) {
      setPendingFollowup({ id: currentLead.id, name: currentLead.name });
      setFollowupForm({
        date: currentLead.nextContact || dateKeyOffset(1),
        time: currentLead.nextContactTime || '',
        action: currentLead.nextAction || 'Retornar contato',
      });
      setFollowupError('');
    }
    return true;
  };

  const scheduleOffset = days => {
    setFollowupForm(current => ({ ...current, date: dateKeyOffset(days) }));
  };

  const savePostWhatsAppFollowup = event => {
    event.preventDefault();
    if (!pendingFollowup) return;
    if (!followupForm.date || followupForm.date < localDateKey()) {
      setFollowupError('Escolha hoje ou uma data futura.');
      return;
    }
    const lead = leads.find(item => item.id === pendingFollowup.id);
    if (!lead) {
      setPendingFollowup(null);
      return;
    }
    const now = new Date().toISOString();
    const action = followupForm.action.trim() || 'Retornar contato';
    setLeads(current => current.map(item => item.id === lead.id ? {
      ...item,
      nextContact: followupForm.date,
      nextContactTime: followupForm.time,
      nextAction: action,
      updatedAt: now,
    } : item));
    logActivity(
      lead,
      'followup_scheduled',
      'Próximo contato agendado',
      `${formatDate(followupForm.date, true)}${followupForm.time ? ` às ${followupForm.time}` : ''} · ${action}`,
      { date: followupForm.date, time: followupForm.time, action },
    );
    setPendingFollowup(null);
    setFollowupError('');
  };

  const applyAutopilotOutcome = ({ leadId, outcome, label, status, nextDays = null, nextAction = '', saleValue = null }) => {
    const previous = leads.find(lead => lead.id === leadId);
    if (!previous) return false;

    let resolvedStatus = status || previous.status;
    if ((outcome === 'talked' || outcome === 'later') && previous.status === 'Novo lead') resolvedStatus = 'Contatado';

    const numericSaleValue = Number(saleValue ?? previous.value ?? 0);
    if (resolvedStatus === 'Fechado' && (!Number.isFinite(numericSaleValue) || numericSaleValue <= 0)) return false;

    let next = applyStatusTransition(previous, {}, resolvedStatus, resolvedStatus === 'Fechado' ? numericSaleValue : undefined);
    const now = new Date().toISOString();
    next = { ...next, lastFollowupAt: now, updatedAt: now };

    if (!CLOSED.includes(next.status)) {
      const hasSuggestedDate = Number.isFinite(Number(nextDays));
      next.nextContact = hasSuggestedDate ? dateKeyOffset(Number(nextDays)) : (next.nextContact || '');
      next.nextContactTime = '';
      next.nextAction = nextAction || next.nextAction || 'Retornar contato';
    }

    setLeads(current => current.map(lead => lead.id === leadId ? next : lead));

    const statusDetail = resolvedStatus !== previous.status ? `Status: ${previous.status} → ${resolvedStatus}.` : '';
    const scheduleDetail = next.nextContact
      ? `Próximo contato: ${formatDate(next.nextContact, true)} · ${next.nextAction}.`
      : CLOSED.includes(next.status) ? 'Negociação encerrada e removida da fila de follow-up.' : '';
    const detail = [statusDetail, scheduleDetail].filter(Boolean).join(' ');

    logActivity(
      previous,
      'autopilot_outcome',
      `Autopilot: ${label || 'resultado registrado'}`,
      detail || 'Resultado do contato registrado pelo Autopilot.',
      {
        outcome,
        from: previous.status,
        to: resolvedStatus,
        nextContact: next.nextContact || null,
        nextAction: next.nextAction || null,
        saleValue: resolvedStatus === 'Fechado' ? numericSaleValue : null,
      },
    );
    return true;
  };

  const handleLogout = () => {
    if (!account?.id) return;
    logoutAccount(account.id);
    window.location.reload();
  };

  const commitStatusChange = (id, status, saleValue) => {
    const previous = leads.find(lead => lead.id === id);
    if (!previous || previous.status === status) return;
    const next = applyStatusTransition(previous, {}, status, saleValue);
    setLeads(current => current.map(lead => lead.id === id ? next : lead));

    if (status === 'Fechado') {
      logActivity(previous, 'sale_closed', 'Venda fechada', `Valor final: ${currency(next.saleValue)}.`, { from: previous.status, saleValue: next.saleValue });
    } else {
      logActivity(previous, 'status_changed', `Status alterado para ${status}`, `Antes: ${previous.status}.`, { from: previous.status, to: status });
    }
  };

  const requestStatusChange = (id, status) => {
    const lead = leads.find(item => item.id === id);
    if (!lead || lead.status === status) return;
    if (status === 'Fechado') {
      setSaleError('');
      setPendingSale({ id, name: lead.name, value: lead.saleValue ?? lead.value ?? '' });
      return;
    }
    commitStatusChange(id, status);
  };

  const onDrop = status => {
    if (!draggedId) return;
    const id = draggedId;
    setDraggedId(null);
    if (statusFilter !== 'Todos' && statusFilter !== status) setStatusFilter('Todos');
    requestStatusChange(id, status);
  };

  const confirmSale = event => {
    event.preventDefault();
    if (!pendingSale) return;
    const value = Number(pendingSale.value);
    if (!Number.isFinite(value) || value <= 0) {
      setSaleError('Informe o valor final da venda, maior que zero.');
      return;
    }
    commitStatusChange(pendingSale.id, 'Fechado', value);
    setPendingSale(null);
    setSaleError('');
  };

  const addLead = event => {
    event.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Informe o nome do lead.');
    if (!validBrazilPhone(form.phone)) return setFormError('Digite um WhatsApp brasileiro válido com DDD.');
    if (isDuplicatePhone(form.phone)) return setFormError('Já existe um lead com esse WhatsApp.');
    if (Number(form.value || 0) < 0) return setFormError('O valor potencial não pode ser negativo.');

    const now = new Date().toISOString();
    const next = {
      id: crypto.randomUUID(),
      ...form,
      assignedTo: form.assignedTo || account?.id || null,
      name: form.name.trim(),
      company: form.company.trim(),
      status: CLOSED.includes(form.status) ? 'Novo lead' : form.status,
      phone: canonicalPhone(form.phone),
      value: Number(form.value || 0),
      createdAt: now,
      updatedAt: now,
      lastFollowupAt: null,
      soldAt: null,
      lostAt: null,
      saleValue: null,
      saleValueSource: null,
    };
    setLeads(current => [next, ...current]);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(false);

    if (account?.id) {
      syncLeads([next], account.id)
        .then(() => logActivity(next, 'lead_created', 'Lead criado', `${next.status} · ${next.origin || 'Outro'} · Responsável: ${memberName(next.assignedTo)}.`, { status: next.status, origin: next.origin, assignedTo: next.assignedTo }))
        .catch(error => console.error('New lead initial sync failed:', error));
    }
  };

  const openLead = lead => {
    setSelectedLeadId(lead.id);
    setEditingLead(null);
    setFormError('');
  };

  const startEditing = () => {
    if (!selectedLead) return;
    setFormError('');
    setEditingLead({ ...selectedLead, assignedTo: selectedLead.assignedTo || account?.id || '', value: selectedLead.value ?? '', saleValue: selectedLead.saleValue ?? '' });
  };

  const saveLead = event => {
    event.preventDefault();
    if (!editingLead || !selectedLead) return;
    setFormError('');
    if (!editingLead.name?.trim()) return setFormError('Informe o nome do lead.');
    if (!validBrazilPhone(editingLead.phone)) return setFormError('Digite um WhatsApp brasileiro válido com DDD.');
    if (isDuplicatePhone(editingLead.phone, editingLead.id)) return setFormError('Já existe outro lead com esse WhatsApp.');
    if (Number(editingLead.value || 0) < 0) return setFormError('O valor potencial não pode ser negativo.');
    if (editingLead.status === 'Fechado' && Number(editingLead.saleValue) <= 0) return setFormError('Informe o valor final da venda.');

    const previous = selectedLead;
    const draft = {
      ...editingLead,
      assignedTo: editingLead.assignedTo || account?.id || null,
      name: editingLead.name.trim(),
      company: String(editingLead.company || '').trim(),
      phone: canonicalPhone(editingLead.phone),
      value: Number(editingLead.value || 0),
    };
    const next = applyStatusTransition(previous, draft, draft.status, draft.saleValue);
    setLeads(current => current.map(lead => lead.id === editingLead.id ? next : lead));

    if (previous.status !== next.status) {
      if (next.status === 'Fechado') {
        logActivity(previous, 'sale_closed', 'Venda fechada', `Valor final: ${currency(next.saleValue)}.`, { from: previous.status, saleValue: next.saleValue });
      } else {
        logActivity(previous, 'status_changed', `Status alterado para ${next.status}`, `Antes: ${previous.status}.`, { from: previous.status, to: next.status });
      }
    } else if (previous.assignedTo !== next.assignedTo) {
      logActivity(previous, 'lead_reassigned', 'Responsável alterado', `${memberName(previous.assignedTo)} → ${memberName(next.assignedTo)}.`, { from: previous.assignedTo || null, to: next.assignedTo || null });
    } else if (previous.nextContact !== next.nextContact || previous.nextContactTime !== next.nextContactTime || previous.nextAction !== next.nextAction) {
      logActivity(previous, 'followup_scheduled', next.nextContact ? 'Próximo contato atualizado' : 'Próximo contato removido', next.nextContact ? `${formatDate(next.nextContact, true)}${next.nextContactTime ? ` às ${next.nextContactTime}` : ''} · ${next.nextAction || 'Retornar contato'}` : 'O lead ficou sem próximo contato marcado.');
    } else {
      logActivity(previous, 'lead_updated', 'Dados do lead atualizados', 'Informações da negociação foram editadas.');
    }

    setEditingLead(null);
    setFormError('');
  };

  const setLeadStatus = status => {
    if (!selectedLead) return;
    requestStatusChange(selectedLead.id, status);
    setEditingLead(null);
  };

  const navigate = label => {
    setActivePage(label);
    setSelectedLeadId(null);
    setEditingLead(null);
    setFormError('');
  };

  const handleLeadActivity = (lead, kind, title, detail = '', metadata = {}) => {
    logActivity(lead, kind, title, detail, metadata);
  };

  const renderSidebar = () => (
    <aside className="sidebar">
      <button type="button" className="logo-wrap logo-button" onClick={() => navigate('Dashboard')} aria-label="Ir para Dashboard">
        <div className="logo-mark"><MessageCircle size={22} strokeWidth={2.4} /></div>
        <span>ZapFlow</span>
      </button>
      <nav className="nav-list" aria-label="Navegação principal">
        {NAV_ITEMS.map(([label, Icon]) => (
          <button type="button" key={label} className={`nav-item ${!selectedLead && activePage === label ? 'active' : ''}`} onClick={() => navigate(label)} aria-current={!selectedLead && activePage === label ? 'page' : undefined}>
            <Icon size={18} /><span>{label}</span>
            {label === 'Leads' && dueFollowups > 0 && <b className="nav-badge" aria-label={`${dueFollowups} follow-ups pendentes`}>{dueFollowups}</b>}
          </button>
        ))}
      </nav>
      <div className="profile-card">
        <div className="avatar" aria-hidden="true">{initials(accountName)}</div>
        <div><strong>{accountName}</strong><span>Grátis · {accountGoal}</span></div>
        <button type="button" className="profile-logout icon-button" onClick={handleLogout} title="Sair da conta" aria-label="Sair da conta"><LogOut size={16} /></button>
      </div>
    </aside>
  );

  const renderLeadDetail = () => {
    if (!selectedLead) return null;
    const temperature = interactionTemperature(selectedLead);

    return (
      <main className="main-content detail-content">
        <div className="detail-topbar">
          <button type="button" className="back-button" onClick={() => { setSelectedLeadId(null); setEditingLead(null); setFormError(''); }}>
            <ArrowLeft size={18} /> Voltar
          </button>
          <div className="detail-top-actions">
            <button type="button" className="primary-button" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir WhatsApp</button>
          </div>
        </div>

        <section className="detail-hero">
          <div className="detail-avatar" aria-hidden="true">{selectedLead.name.slice(0, 2).toUpperCase()}</div>
          <div className="detail-title">
            <div className="detail-title-line">
              <h1>{selectedLead.name}</h1>
              <span className={`detail-status status-${selectedLead.status.toLowerCase().replaceAll(' ', '-')}`}>{selectedLead.status}</span>
              {temperature && <span className={`lead-temperature ${temperature.tone}`}>{temperature.text}</span>}
            </div>
            <p>{selectedLead.company || 'Sem empresa informada'}</p>
          </div>
          <div className="detail-value">
            <span>{selectedLead.status === 'Fechado' ? 'Valor fechado' : 'Valor potencial'}</span>
            <strong>{currency(selectedLead.status === 'Fechado' ? selectedLead.saleValue : selectedLead.value)}</strong>
          </div>
        </section>

        {editingLead ? (
          <form className="detail-grid inline-detail-edit" onSubmit={saveLead}>
            <div className="detail-main-column">
              <section className="detail-card info-edit-card">
                <div className="section-heading inline-section-heading">
                  <div><h2>Informações</h2><p>Edite os dados diretamente aqui.</p></div>
                  <div className="inline-edit-actions">
                    <button type="button" className="secondary-button" onClick={() => { setEditingLead(null); setFormError(''); }}>Cancelar</button>
                    <button className="primary-button"><Save size={16} /> Salvar</button>
                  </div>
                </div>
                <div className="info-grid editable-info-grid">
                  <label className="info-item info-edit-item"><UserRound size={18} /><div><span>Nome</span><input required value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} /></div></label>
                  <label className="info-item info-edit-item"><Building2 size={18} /><div><span>Empresa</span><input value={editingLead.company || ''} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} placeholder="Não informado" /></div></label>
                  <label className="info-item info-edit-item"><Phone size={18} /><div><span>WhatsApp</span><input required inputMode="tel" value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} /></div></label>
                  <label className="info-item info-edit-item"><CircleDollarSign size={18} /><div><span>Valor potencial</span><input type="number" min="0" step="0.01" value={editingLead.value} onChange={e => setEditingLead({ ...editingLead, value: e.target.value })} /></div></label>
                  <label className="info-item info-edit-item"><Target size={18} /><div><span>Status</span><select value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value })}>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></div></label>
                  {editingLead.status === 'Fechado' && <label className="info-item info-edit-item"><CheckCircle2 size={18} /><div><span>Valor fechado</span><input type="number" min="0.01" step="0.01" value={editingLead.saleValue} onChange={e => setEditingLead({ ...editingLead, saleValue: e.target.value })} /></div></label>}
                  <label className="info-item info-edit-item"><MapPin size={18} /><div><span>Origem</span><select value={editingLead.origin || 'Outro'} onChange={e => setEditingLead({ ...editingLead, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></div></label>
                  <label className="info-item info-edit-item"><UsersRound size={18} /><div><span>Responsável</span><select value={editingLead.assignedTo || account?.id || ''} onChange={e => setEditingLead({ ...editingLead, assignedTo: e.target.value })}>{teamMembers.length ? teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.name}{member.user_id === account?.id ? ' (você)' : ''}</option>) : <option value={account?.id || ''}>{accountName}</option>}</select></div></label>
                </div>
                {formError && <div className="auth-error inline-edit-error" role="alert">{formError}</div>}
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Observações</h2><p>Contexto importante da conversa.</p></div></div>
                <textarea className="inline-notes-editor" value={editingLead.notes || ''} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} placeholder="Adicione observações sobre este lead..." />
              </section>

              <LeadHistory userId={account?.id} leadId={selectedLead.id} />
            </div>

            <aside className="detail-side-column">
              <section className="detail-card next-action-card">
                <div className="section-heading"><div><h2>Próxima ação</h2><p>Edite o próximo passo sem sair desta tela.</p></div></div>
                <div className="inline-next-form">
                  <label><span>Data</span><input type="date" min={localDateKey()} value={editingLead.nextContact || ''} onChange={e => setEditingLead({ ...editingLead, nextContact: e.target.value })} disabled={CLOSED.includes(editingLead.status)} /></label>
                  <label><span>Horário</span><input type="time" value={editingLead.nextContactTime || ''} onChange={e => setEditingLead({ ...editingLead, nextContactTime: e.target.value })} disabled={CLOSED.includes(editingLead.status)} /></label>
                  <label className="full"><span>Ação</span><input value={editingLead.nextAction || ''} onChange={e => setEditingLead({ ...editingLead, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" disabled={CLOSED.includes(editingLead.status)} /></label>
                  {CLOSED.includes(editingLead.status) && <small>Leads fechados ou perdidos não precisam de próximo contato.</small>}
                </div>
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Ações</h2><p>Salve antes de avançar a negociação.</p></div></div>
                <div className="detail-actions-stack">
                  <button type="button" className="detail-whatsapp" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir conversa no WhatsApp</button>
                  <button type="submit" className="detail-action sold-action"><Save size={17} /> Salvar alterações</button>
                  <button type="button" className="detail-action" onClick={() => { setEditingLead(null); setFormError(''); }}><X size={17} /> Cancelar edição</button>
                </div>
              </section>
            </aside>
          </form>
        ) : (
          <div className="detail-grid">
            <div className="detail-main-column">
              <section className="detail-card">
                <div className="section-heading">
                  <div><h2>Informações</h2><p>Dados principais deste lead.</p></div>
                  <button type="button" className="secondary-button" onClick={startEditing}><Pencil size={16} /> Editar</button>
                </div>
                <div className="info-grid">
                  <div className="info-item"><UserRound size={18} /><div><span>Nome</span><strong>{selectedLead.name}</strong></div></div>
                  <div className="info-item"><Building2 size={18} /><div><span>Empresa</span><strong>{selectedLead.company || 'Não informado'}</strong></div></div>
                  <div className="info-item"><Phone size={18} /><div><span>WhatsApp</span><strong>{selectedLead.phone}</strong></div></div>
                  <div className="info-item"><CircleDollarSign size={18} /><div><span>Valor potencial</span><strong>{currency(selectedLead.value)}</strong></div></div>
                  {selectedLead.status === 'Fechado' && <div className="info-item"><CheckCircle2 size={18} /><div><span>Valor fechado</span><strong>{currency(selectedLead.saleValue)}</strong></div></div>}
                  <div className="info-item"><Target size={18} /><div><span>Status</span><strong>{selectedLead.status}</strong></div></div>
                  <div className="info-item"><MapPin size={18} /><div><span>Origem</span><strong>{selectedLead.origin || 'Não informado'}</strong></div></div>
                  <div className="info-item"><UsersRound size={18} /><div><span>Responsável</span><strong>{memberName(selectedLead.assignedTo)}</strong></div></div>
                </div>
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Observações</h2><p>Contexto importante da conversa.</p></div></div>
                <div className="notes-box">{selectedLead.notes || 'Nenhuma observação adicionada ainda.'}</div>
              </section>

              <LeadHistory userId={account?.id} leadId={selectedLead.id} />
            </div>

            <aside className="detail-side-column">
              <section className="detail-card next-action-card">
                <div className="section-heading"><div><h2>Próxima ação</h2><p>O que precisa acontecer depois.</p></div></div>
                {selectedLead.nextContact ? (
                  <div className="action-schedule">
                    <div className="action-date-icon"><CalendarClock size={21} /></div>
                    <div>
                      <strong>{formatDate(selectedLead.nextContact, true)}{selectedLead.nextContactTime ? ` às ${selectedLead.nextContactTime}` : ''}</strong>
                      <span>{selectedLead.nextAction || 'Retornar contato'}</span>
                    </div>
                  </div>
                ) : <div className="no-action">Nenhum próximo contato programado.</div>}
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Ações</h2><p>Atalhos para avançar a negociação.</p></div></div>
                <div className="detail-actions-stack">
                  <button type="button" className="detail-whatsapp" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir conversa no WhatsApp</button>
                  {selectedLead.status !== 'Fechado' && <button type="button" className="detail-action sold-action" onClick={() => setLeadStatus('Fechado')}><CheckCircle2 size={17} /> Marcar como fechado</button>}
                  {selectedLead.status !== 'Perdido' && <button type="button" className="detail-action lost-action" onClick={() => setLeadStatus('Perdido')}><XCircle size={17} /> Marcar como perdido</button>}
                  <button type="button" className="detail-action" onClick={startEditing}><Pencil size={17} /> Editar cliente</button>
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
    );
  };

  const renderPipeline = () => (
    <main className="main-content">
      <header className="page-header">
        <div><h1>Pipeline</h1><p>Organize seus clientes e não perca follow-ups.</p></div>
        <div className="header-actions">
          <label className="search-box"><Search size={17} /><span className="sr-only">Buscar clientes</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar clientes" /></label>
          <label className="filter-control"><Filter size={16} /><span className="sr-only">Filtrar por status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por status"><option>Todos</option>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
          <label className="filter-control hide-tablet"><span className="sr-only">Filtrar por origem</span><select value={originFilter} onChange={e => setOriginFilter(e.target.value)} aria-label="Filtrar por origem"><option>Todas</option>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
          {teamMembers.length > 1 && <label className="filter-control team-filter"><UsersRound size={16} /><span className="sr-only">Filtrar por responsável</span><select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} aria-label="Filtrar por responsável"><option value="Todos">Todos da equipe</option>{teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.user_id === account?.id ? 'Meus leads' : member.name}</option>)}</select></label>}
          <button type="button" className="primary-button" onClick={() => openNewLead()}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="metrics-grid" aria-label="Resumo do pipeline">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return <article className="metric-card" key={metric.label}>
            <div className={`metric-icon ${metric.tone}`}><Icon size={18} /></div>
            <div className="metric-copy"><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.helper}</small></div>
          </article>;
        })}
      </section>

      <section className="pipeline-scroll" aria-label="Etapas do pipeline">
        <div className="pipeline-board">
          {STATUSES.map(status => {
            const columnLeads = filteredLeads.filter(lead => lead.status === status.id);
            return (
              <section className={`pipeline-column ${status.className}`} key={status.id} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(status.id)}>
                <div className="column-header"><div><span className="status-dot" /><strong>{status.id}</strong></div><span className="count-pill">{columnLeads.length}</span></div>
                <div className="column-body">
                  {columnLeads.map(lead => (
                    <article className="lead-card" key={lead.id} draggable onDragStart={() => setDraggedId(lead.id)} onDragEnd={() => setDraggedId(null)} onClick={() => openLead(lead)}>
                      <div className="lead-heading"><div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span></div><button type="button" className="icon-button" aria-label={`Abrir ${lead.name}`} onClick={e => { e.stopPropagation(); openLead(lead); }}><MoreHorizontal size={18} /></button></div>
                      <b className="lead-value">{currency(status.id === 'Fechado' ? lead.saleValue : lead.value)}</b>
                      {teamMembers.length > 1 && <div className="lead-assignee"><UserRound size={13} /><span>{memberName(lead.assignedTo)}</span></div>}
                      <label className="mobile-status-control" onClick={e => e.stopPropagation()}>
                        <span>Status</span>
                        <select value={lead.status} onChange={e => requestStatusChange(lead.id, e.target.value)} aria-label={`Alterar status de ${lead.name}`}>
                          {STATUSES.map(option => <option key={option.id}>{option.id}</option>)}
                        </select>
                      </label>
                      {lead.nextContact ? <div className="next-contact"><CalendarClock size={14} /> Próximo contato: {formatDate(lead.nextContact)}</div> : <div className={`lead-tag ${status.id === 'Fechado' ? 'success' : status.id === 'Perdido' ? 'danger' : ''}`}>{status.id === 'Fechado' ? 'Venda fechada' : status.id === 'Perdido' ? (lead.notes || 'Negociação encerrada') : 'Sem próximo contato'}</div>}
                      <div className="lead-actions">
                        <button type="button" className="whatsapp-button" onClick={e => { e.stopPropagation(); openWhatsApp(lead); }}><MessageCircle size={16} /> Abrir WhatsApp</button>
                        <button type="button" className="icon-button" aria-label={`Ver detalhes de ${lead.name}`} onClick={e => { e.stopPropagation(); openLead(lead); }}><MoreHorizontal size={18} /></button>
                      </div>
                    </article>
                  ))}
                  {columnLeads.length === 0 && <div className="empty-column">Nenhum lead nesta etapa</div>}
                </div>
                {!CLOSED.includes(status.id) && <button type="button" className="add-column-lead" onClick={() => openNewLead(status.id)}><Plus size={15} /> Adicionar lead</button>}
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );

  const renderActivePage = () => {
    if (selectedLead) return renderLeadDetail();
    if (activePage === 'Dashboard') return <Dashboard leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onAutopilotOutcome={applyAutopilotOutcome} onNewLead={() => openNewLead()} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} teamMembers={teamMembers} currentUserId={account?.id || null} />;
    if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} />;
    if (activePage === 'Mensagens') return <Messages leads={leads} openWhatsApp={openWhatsApp} userId={account?.id} />;
    if (activePage === 'Configurações') return <SettingsPage account={account} onAccountChange={setAccount} onLogout={handleLogout} />;
    return renderPipeline();
  };

  return (
    <div className="app-shell">
      {renderSidebar()}
      <button type="button" className="mobile-logout" onClick={handleLogout} aria-label="Sair da conta" title="Sair"><LogOut size={16} /></button>
      {renderActivePage()}

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-lead-title" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2 id="new-lead-title">Novo lead</h2><p>Adicione um novo contato ao pipeline.</p></div><button type="button" className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fechar"><X size={20} /></button></div>
            <form onSubmit={addLead} className="lead-form">
              <label><span>Nome *</span><input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Studio Bella" /></label>
              <label><span>WhatsApp *</span><input required inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="21999999999" /></label>
              <label><span>Empresa</span><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Ex.: Salão de beleza" /></label>
              <label><span>Valor potencial</span><input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="350,00" /></label>
              <label><span>Status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{OPEN_STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
              <label><span>Origem</span><select value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
              <label><span>Responsável</span><select value={form.assignedTo || account?.id || ''} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>{teamMembers.length ? teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.name}{member.user_id === account?.id ? ' (você)' : ''}</option>) : <option value={account?.id || ''}>{accountName}</option>}</select></label>
              <label><span>Próximo contato</span><input type="date" min={localDateKey()} value={form.nextContact} onChange={e => setForm({ ...form, nextContact: e.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={form.nextContactTime} onChange={e => setForm({ ...form, nextContactTime: e.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" /></label>
              <label className="full"><span>Observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Contexto da conversa..." /></label>
              {formError && <div className="auth-error full" role="alert">{formError}</div>}
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => { setModalOpen(false); setFormError(''); }}>Cancelar</button><button className="primary-button"><Plus size={16} /> Adicionar lead</button></div>
            </form>
          </section>
        </div>
      )}

      {pendingFollowup && (
        <div className="modal-backdrop" onMouseDown={() => setPendingFollowup(null)}>
          <section className="modal followup-modal" role="dialog" aria-modal="true" aria-labelledby="followup-modal-title" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2 id="followup-modal-title">Quando falar com {pendingFollowup.name} de novo?</h2><p>O WhatsApp foi aberto. Marque o próximo passo antes que essa venda suma da memória.</p></div><button type="button" className="icon-button" onClick={() => setPendingFollowup(null)} aria-label="Fechar"><X size={20} /></button></div>
            <div className="followup-intro"><div className="followup-intro-icon"><MessageCircle size={17} /></div><div><strong>Contato registrado</strong><span>Registramos apenas que o WhatsApp foi aberto. Não afirmamos que a mensagem foi enviada ou lida.</span></div></div>
            <div className="followup-quick" aria-label="Atalhos de data">
              <button type="button" className={followupForm.date === dateKeyOffset(1) ? 'active' : ''} onClick={() => scheduleOffset(1)}>Amanhã</button>
              <button type="button" className={followupForm.date === dateKeyOffset(3) ? 'active' : ''} onClick={() => scheduleOffset(3)}>+3 dias</button>
              <button type="button" className={followupForm.date === dateKeyOffset(7) ? 'active' : ''} onClick={() => scheduleOffset(7)}>+7 dias</button>
            </div>
            <form className="lead-form" onSubmit={savePostWhatsAppFollowup}>
              <label><span>Data *</span><input required type="date" min={localDateKey()} value={followupForm.date} onChange={e => setFollowupForm({ ...followupForm, date: e.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={followupForm.time} onChange={e => setFollowupForm({ ...followupForm, time: e.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={followupForm.action} onChange={e => setFollowupForm({ ...followupForm, action: e.target.value })} placeholder="Ex.: Cobrar retorno da proposta" /></label>
              <p className="followup-note full">Se não precisar de outro contato, use “Agora não”. O registro de que você abriu o WhatsApp continua no histórico.</p>
              {followupError && <div className="auth-error full" role="alert">{followupError}</div>}
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => setPendingFollowup(null)}>Agora não</button><button className="primary-button"><CalendarClock size={16} /> Agendar próximo contato</button></div>
            </form>
          </section>
        </div>
      )}

      {pendingSale && (
        <div className="modal-backdrop" onMouseDown={() => { setPendingSale(null); setSaleError(''); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="sale-modal-title" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2 id="sale-modal-title">Fechar venda</h2><p>{pendingSale.name} · registre o valor que realmente foi fechado.</p></div><button type="button" className="icon-button" onClick={() => { setPendingSale(null); setSaleError(''); }} aria-label="Fechar"><X size={20} /></button></div>
            <form className="lead-form" onSubmit={confirmSale}>
              <label className="full"><span>Valor fechado *</span><input autoFocus type="number" min="0.01" step="0.01" value={pendingSale.value} onChange={e => setPendingSale({ ...pendingSale, value: e.target.value })} /></label>
              {saleError && <div className="auth-error full" role="alert">{saleError}</div>}
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => { setPendingSale(null); setSaleError(''); }}>Cancelar</button><button className="primary-button"><CheckCircle2 size={16} /> Confirmar venda</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}