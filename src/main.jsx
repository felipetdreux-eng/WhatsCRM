import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Filter,
  LayoutDashboard,
  ListFilter,
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
import ComingSoon from './ComingSoon';
import './styles.css';
import './detail.css';

const STATUSES = [
  { id: 'Novo lead', className: 'new' },
  { id: 'Contatado', className: 'contacted' },
  { id: 'Interessado', className: 'interested' },
  { id: 'Proposta enviada', className: 'proposal' },
  { id: 'Vendido', className: 'sold' },
  { id: 'Perdido', className: 'lost' },
];

const ORIGINS = ['Google Maps', 'Instagram', 'Indicação', 'Site', 'WhatsApp', 'Outro'];

const DEMO_LEADS = [
  { id: '1', name: 'Studio Bella', company: 'Salão de beleza', phone: '21999999991', value: 350, status: 'Novo lead', origin: 'Google Maps', nextContact: '2026-09-08', nextContactTime: '15:00', nextAction: 'Fazer primeiro contato', notes: 'Primeiro contato pendente.', createdAt: '2026-09-07T12:00:00.000Z' },
  { id: '2', name: 'Mercado Silva', company: 'Mercado', phone: '21999999992', value: 250, status: 'Novo lead', origin: 'Google Maps', nextContact: '2026-09-09', nextContactTime: '', nextAction: 'Apresentar serviço', notes: '', createdAt: '2026-09-07T11:00:00.000Z' },
  { id: '3', name: 'Pet Care Feliz', company: 'Pet shop', phone: '21999999993', value: 400, status: 'Novo lead', origin: 'Instagram', nextContact: '2026-09-07', nextContactTime: '16:30', nextAction: 'Enviar mensagem', notes: '', createdAt: '2026-09-06T18:00:00.000Z' },
  { id: '4', name: 'Barbearia Prime', company: 'Barbearia', phone: '21999999994', value: 300, status: 'Contatado', origin: 'Google Maps', nextContact: '2026-09-08', nextContactTime: '11:00', nextAction: 'Perguntar se recebeu', notes: 'Mensagem enviada.', createdAt: '2026-09-06T15:00:00.000Z' },
  { id: '5', name: 'Padaria do João', company: 'Padaria', phone: '21999999995', value: 500, status: 'Contatado', origin: 'Indicação', nextContact: '2026-09-10', nextContactTime: '14:00', nextAction: 'Retornar contato', notes: '', createdAt: '2026-09-05T17:00:00.000Z' },
  { id: '6', name: 'João Fotografia', company: 'Estúdio de fotografia', phone: '21999999996', value: 600, status: 'Interessado', origin: 'Instagram', nextContact: '2026-09-08', nextContactTime: '10:00', nextAction: 'Mandar proposta', notes: 'Gostou da proposta inicial.', createdAt: '2026-09-05T14:00:00.000Z' },
  { id: '7', name: 'Ana Design', company: 'Design gráfico', phone: '21999999997', value: 450, status: 'Interessado', origin: 'Instagram', nextContact: '2026-09-10', nextContactTime: '', nextAction: 'Alinhar escopo', notes: '', createdAt: '2026-09-04T13:00:00.000Z' },
  { id: '8', name: 'Alpha Elétrica', company: 'Serviços elétricos', phone: '21999999998', value: 750, status: 'Proposta enviada', origin: 'Google Maps', nextContact: '2026-09-11', nextContactTime: '15:30', nextAction: 'Cobrar retorno da proposta', notes: 'Proposta enviada por WhatsApp.', createdAt: '2026-09-04T10:00:00.000Z' },
  { id: '9', name: 'Oficina JM', company: 'Oficina mecânica', phone: '21999999999', value: 850, status: 'Proposta enviada', origin: 'Google Maps', nextContact: '2026-09-12', nextContactTime: '09:30', nextAction: 'Fazer follow-up', notes: '', createdAt: '2026-09-03T18:00:00.000Z' },
  { id: '10', name: 'Personal Lucas', company: 'Personal trainer', phone: '21999999980', value: 650, saleValue: 600, status: 'Vendido', origin: 'Indicação', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Cliente ativo.', createdAt: '2026-09-02T14:00:00.000Z', soldAt: '2026-09-06T16:00:00.000Z' },
  { id: '11', name: 'Restaurante Sabor', company: 'Restaurante', phone: '21999999981', value: 700, saleValue: 700, status: 'Vendido', origin: 'Site', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Cliente ativo.', createdAt: '2026-09-01T15:00:00.000Z', soldAt: '2026-09-05T16:00:00.000Z' },
  { id: '12', name: 'Tech Solutions', company: 'TI e informática', phone: '21999999982', value: 400, status: 'Perdido', origin: 'Google Maps', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Sem retorno.', createdAt: '2026-08-31T14:00:00.000Z', lostAt: '2026-09-05T11:00:00.000Z' },
  { id: '13', name: 'Academia Move', company: 'Academia', phone: '21999999983', value: 550, status: 'Perdido', origin: 'Instagram', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Escolheu concorrente.', createdAt: '2026-08-30T12:00:00.000Z', lostAt: '2026-09-04T12:00:00.000Z' },
];

const navItems = [
  ['Dashboard', LayoutDashboard],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];

const emptyForm = {
  name: '', company: '', phone: '', value: '', status: 'Novo lead', origin: 'Google Maps',
  nextContact: '', nextContactTime: '', nextAction: '', notes: '',
};

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(Number(value || 0));

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value, long = false) {
  if (!value) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T12:00:00`);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (!long && date.toDateString() === today.toDateString()) return 'Hoje';
  if (!long && date.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return date.toLocaleDateString('pt-BR', long
    ? { day: '2-digit', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: '2-digit' });
}

function canonicalPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  return digits;
}

function validBrazilPhone(phone) {
  const digits = canonicalPhone(phone);
  return digits.length === 10 || digits.length === 11;
}

function whatsappPhone(phone) {
  const digits = canonicalPhone(phone);
  return digits ? `55${digits}` : '';
}

function statusTone(status) {
  if (status === 'Contatado') return 'blue';
  if (status === 'Interessado') return 'purple';
  if (status === 'Proposta enviada') return 'red';
  if (status === 'Vendido') return 'green';
  if (status === 'Perdido') return 'red';
  return 'neutral';
}

function applyStatusTransition(previous, draft, nextStatus, saleValue) {
  const now = new Date().toISOString();
  const changed = previous.status !== nextStatus;
  const next = { ...previous, ...draft, status: nextStatus, updatedAt: now };

  if (nextStatus === 'Vendido') {
    next.saleValue = Number(saleValue ?? draft.saleValue ?? previous.saleValue ?? 0);
    next.soldAt = previous.status === 'Vendido' && previous.soldAt ? previous.soldAt : now;
    next.lostAt = null;
    next.nextContact = '';
    next.nextContactTime = '';
    next.nextAction = '';
  } else if (nextStatus === 'Perdido') {
    next.saleValue = null;
    next.soldAt = null;
    next.lostAt = previous.status === 'Perdido' && previous.lostAt ? previous.lostAt : now;
    next.nextContact = '';
    next.nextContactTime = '';
    next.nextAction = '';
  } else if (changed && ['Vendido', 'Perdido'].includes(previous.status)) {
    next.saleValue = null;
    next.soldAt = null;
    next.lostAt = null;
  }

  return next;
}

function App() {
  const [leads, setLeads] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('zapflow-leads'));
      return Array.isArray(saved) ? saved : DEMO_LEADS;
    } catch {
      return DEMO_LEADS;
    }
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [originFilter, setOriginFilter] = useState('Todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [activePage, setActivePage] = useState('Dashboard');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [pendingSale, setPendingSale] = useState(null);
  const [saleError, setSaleError] = useState('');

  useEffect(() => {
    localStorage.setItem('zapflow-leads', JSON.stringify(leads));
  }, [leads]);

  const selectedLead = leads.find(lead => lead.id === selectedLeadId) || null;

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const haystack = `${lead.name} ${lead.company} ${lead.phone} ${lead.origin} ${lead.status}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase())
      && (statusFilter === 'Todos' || lead.status === statusFilter)
      && (originFilter === 'Todas' || lead.origin === originFilter);
  }), [leads, query, statusFilter, originFilter]);

  const dueFollowups = leads.filter(lead => lead.nextContact && !['Vendido', 'Perdido'].includes(lead.status) && lead.nextContact <= localDateKey()).length;

  const metrics = STATUSES.map(status => {
    const items = filteredLeads.filter(lead => lead.status === status.id);
    const amount = items.reduce((sum, lead) => sum + Number(status.id === 'Vendido' ? lead.saleValue || 0 : lead.value || 0), 0);
    return {
      label: status.id,
      value: items.length,
      helper: status.id === 'Vendido' ? `${currency(amount)} fechados` : `${currency(amount)} em valor`,
      icon: status.id === 'Vendido' ? CheckCircle2 : status.id === 'Perdido' ? XCircle : Target,
      tone: statusTone(status.id),
    };
  });

  const isDuplicatePhone = (phone, exceptId = null) => {
    const canonical = canonicalPhone(phone);
    return leads.some(lead => lead.id !== exceptId && canonicalPhone(lead.phone) === canonical);
  };

  const openWhatsApp = (lead, message = '') => {
    const phone = whatsappPhone(lead.phone);
    if (!phone) return;
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    window.open(`https://wa.me/${phone}${text}`, '_blank', 'noopener,noreferrer');
  };

  const commitStatusChange = (id, status, saleValue) => {
    setLeads(current => current.map(lead => lead.id === id
      ? applyStatusTransition(lead, {}, status, saleValue)
      : lead));
  };

  const requestStatusChange = (id, status) => {
    const lead = leads.find(item => item.id === id);
    if (!lead || lead.status === status) return;
    if (status === 'Vendido') {
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
    commitStatusChange(pendingSale.id, 'Vendido', value);
    setPendingSale(null);
    setSaleError('');
  };

  const addLead = event => {
    event.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Informe o nome do lead.');
    if (!validBrazilPhone(form.phone)) return setFormError('Digite um WhatsApp válido com DDD.');
    if (isDuplicatePhone(form.phone)) return setFormError('Já existe um lead com esse WhatsApp.');

    const now = new Date().toISOString();
    const next = {
      id: crypto.randomUUID(),
      ...form,
      phone: canonicalPhone(form.phone),
      value: Number(form.value || 0),
      createdAt: now,
      updatedAt: now,
      soldAt: null,
      lostAt: null,
      saleValue: null,
    };
    setLeads(current => [next, ...current]);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(false);
  };

  const openLead = lead => {
    setSelectedLeadId(lead.id);
    setEditingLead(null);
    setFormError('');
  };

  const startEditing = () => {
    if (!selectedLead) return;
    setFormError('');
    setEditingLead({ ...selectedLead, value: selectedLead.value ?? '', saleValue: selectedLead.saleValue ?? '' });
  };

  const saveLead = event => {
    event.preventDefault();
    if (!editingLead) return;
    setFormError('');
    if (!editingLead.name?.trim()) return setFormError('Informe o nome do lead.');
    if (!validBrazilPhone(editingLead.phone)) return setFormError('Digite um WhatsApp válido com DDD.');
    if (isDuplicatePhone(editingLead.phone, editingLead.id)) return setFormError('Já existe outro lead com esse WhatsApp.');
    if (editingLead.status === 'Vendido' && Number(editingLead.saleValue) <= 0) return setFormError('Informe o valor final da venda.');

    setLeads(current => current.map(lead => {
      if (lead.id !== editingLead.id) return lead;
      const draft = {
        ...editingLead,
        phone: canonicalPhone(editingLead.phone),
        value: Number(editingLead.value || 0),
      };
      return applyStatusTransition(lead, draft, draft.status, draft.saleValue);
    }));
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

  const renderSidebar = () => (
    <aside className="sidebar">
      <button className="logo-wrap logo-button" onClick={() => navigate('Dashboard')} aria-label="Ir para Dashboard">
        <div className="logo-mark"><MessageCircle size={22} strokeWidth={2.4} /></div>
        <span>ZapFlow</span>
      </button>
      <nav className="nav-list" aria-label="Navegação principal">
        {navItems.map(([label, Icon]) => (
          <button key={label} className={`nav-item ${!selectedLead && activePage === label ? 'active' : ''}`} onClick={() => navigate(label)}>
            <Icon size={18} /><span>{label}</span>
            {label === 'Leads' && dueFollowups > 0 && <b className="nav-badge">{dueFollowups}</b>}
          </button>
        ))}
      </nav>
      <div className="profile-card">
        <div className="avatar">FA</div>
        <div><strong>Felipe</strong><span>Plano gratuito</span></div>
        <ChevronDown size={16} />
      </div>
    </aside>
  );

  const renderLeadDetail = () => {
    if (!selectedLead) return null;

    return (
      <main className="main-content detail-content">
        <div className="detail-topbar">
          <button className="back-button" onClick={() => { setSelectedLeadId(null); setEditingLead(null); setFormError(''); }}>
            <ArrowLeft size={18} /> Voltar
          </button>
          <div className="detail-top-actions">
            {!editingLead && <button className="secondary-button" onClick={startEditing}><Pencil size={16} /> Editar</button>}
            <button className="primary-button" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir WhatsApp</button>
          </div>
        </div>

        <section className="detail-hero">
          <div className="detail-avatar">{selectedLead.name.slice(0, 2).toUpperCase()}</div>
          <div className="detail-title">
            <div className="detail-title-line">
              <h1>{selectedLead.name}</h1>
              <span className={`detail-status status-${selectedLead.status.toLowerCase().replaceAll(' ', '-')}`}>{selectedLead.status}</span>
            </div>
            <p>{selectedLead.company || 'Sem empresa informada'}</p>
          </div>
          <div className="detail-value">
            <span>{selectedLead.status === 'Vendido' ? 'Valor vendido' : 'Valor potencial'}</span>
            <strong>{currency(selectedLead.status === 'Vendido' ? selectedLead.saleValue : selectedLead.value)}</strong>
          </div>
        </section>

        {editingLead ? (
          <section className="detail-card edit-card">
            <div className="section-heading"><div><h2>Editar cliente</h2><p>Atualize as informações e salve.</p></div></div>
            <form className="lead-form detail-edit-form" onSubmit={saveLead}>
              <label><span>Nome *</span><input required value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} /></label>
              <label><span>WhatsApp *</span><input required inputMode="tel" value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} /></label>
              <label><span>Empresa</span><input value={editingLead.company || ''} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} /></label>
              <label><span>Valor potencial</span><input type="number" min="0" value={editingLead.value} onChange={e => setEditingLead({ ...editingLead, value: e.target.value })} /></label>
              <label><span>Status</span><select value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value })}>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
              {editingLead.status === 'Vendido' && <label><span>Valor vendido *</span><input type="number" min="0.01" step="0.01" value={editingLead.saleValue} onChange={e => setEditingLead({ ...editingLead, saleValue: e.target.value })} /></label>}
              <label><span>Origem</span><select value={editingLead.origin || 'Outro'} onChange={e => setEditingLead({ ...editingLead, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
              <label><span>Próximo contato</span><input type="date" value={editingLead.nextContact || ''} onChange={e => setEditingLead({ ...editingLead, nextContact: e.target.value })} disabled={['Vendido', 'Perdido'].includes(editingLead.status)} /></label>
              <label><span>Horário</span><input type="time" value={editingLead.nextContactTime || ''} onChange={e => setEditingLead({ ...editingLead, nextContactTime: e.target.value })} disabled={['Vendido', 'Perdido'].includes(editingLead.status)} /></label>
              <label className="full"><span>Próxima ação</span><input value={editingLead.nextAction || ''} onChange={e => setEditingLead({ ...editingLead, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" disabled={['Vendido', 'Perdido'].includes(editingLead.status)} /></label>
              <label className="full"><span>Observações</span><textarea value={editingLead.notes || ''} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} /></label>
              {formError && <div className="auth-error full" role="alert">{formError}</div>}
              <div className="modal-actions full">
                <button type="button" className="secondary-button" onClick={() => { setEditingLead(null); setFormError(''); }}>Cancelar</button>
                <button className="primary-button"><Save size={16} /> Salvar alterações</button>
              </div>
            </form>
          </section>
        ) : (
          <div className="detail-grid">
            <div className="detail-main-column">
              <section className="detail-card">
                <div className="section-heading"><div><h2>Informações</h2><p>Dados principais deste lead.</p></div></div>
                <div className="info-grid">
                  <div className="info-item"><UserRound size={18} /><div><span>Nome</span><strong>{selectedLead.name}</strong></div></div>
                  <div className="info-item"><Building2 size={18} /><div><span>Empresa</span><strong>{selectedLead.company || 'Não informado'}</strong></div></div>
                  <div className="info-item"><Phone size={18} /><div><span>WhatsApp</span><strong>{selectedLead.phone}</strong></div></div>
                  <div className="info-item"><CircleDollarSign size={18} /><div><span>Valor potencial</span><strong>{currency(selectedLead.value)}</strong></div></div>
                  {selectedLead.status === 'Vendido' && <div className="info-item"><CheckCircle2 size={18} /><div><span>Valor vendido</span><strong>{currency(selectedLead.saleValue)}</strong></div></div>}
                  <div className="info-item"><Target size={18} /><div><span>Status</span><strong>{selectedLead.status}</strong></div></div>
                  <div className="info-item"><MapPin size={18} /><div><span>Origem</span><strong>{selectedLead.origin || 'Não informado'}</strong></div></div>
                </div>
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Observações</h2><p>Contexto importante da conversa.</p></div></div>
                <div className="notes-box">{selectedLead.notes || 'Nenhuma observação adicionada ainda.'}</div>
              </section>
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
                  <button className="detail-whatsapp" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir conversa no WhatsApp</button>
                  {selectedLead.status !== 'Vendido' && <button className="detail-action sold-action" onClick={() => setLeadStatus('Vendido')}><CheckCircle2 size={17} /> Marcar como vendido</button>}
                  {selectedLead.status !== 'Perdido' && <button className="detail-action lost-action" onClick={() => setLeadStatus('Perdido')}><XCircle size={17} /> Marcar como perdido</button>}
                  <button className="detail-action" onClick={startEditing}><Pencil size={17} /> Editar cliente</button>
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
          <label className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente" /></label>
          <label className="filter-control"><Filter size={16} /><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>Todos</option>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
          <label className="filter-control hide-tablet"><select value={originFilter} onChange={e => setOriginFilter(e.target.value)}><option>Todas</option>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
          <button className="primary-button" onClick={() => { setForm(emptyForm); setFormError(''); setModalOpen(true); }}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="metrics-grid">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return <article className="metric-card" key={metric.label}>
            <div className={`metric-icon ${metric.tone}`}><Icon size={18} /></div>
            <div className="metric-copy"><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.helper}</small></div>
          </article>;
        })}
      </section>

      <section className="pipeline-scroll">
        <div className="pipeline-board">
          {STATUSES.map(status => {
            const columnLeads = filteredLeads.filter(lead => lead.status === status.id);
            return <section className={`pipeline-column ${status.className}`} key={status.id} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(status.id)}>
              <div className="column-header"><div><span className="status-dot" /><strong>{status.id}</strong></div><span className="count-pill">{columnLeads.length}</span></div>
              <div className="column-body">
                {columnLeads.map(lead => (
                  <article className="lead-card" key={lead.id} draggable onDragStart={() => setDraggedId(lead.id)} onDragEnd={() => setDraggedId(null)} onClick={() => openLead(lead)}>
                    <div className="lead-heading"><div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span></div><button className="icon-button" aria-label="Abrir cliente" onClick={e => { e.stopPropagation(); openLead(lead); }}><MoreHorizontal size={18} /></button></div>
                    <b className="lead-value">{currency(status.id === 'Vendido' ? lead.saleValue : lead.value)}</b>
                    {lead.nextContact ? <div className="next-contact"><CalendarClock size={14} /> Próximo contato: {formatDate(lead.nextContact)}</div> : <div className={`lead-tag ${status.id === 'Vendido' ? 'success' : status.id === 'Perdido' ? 'danger' : ''}`}>{status.id === 'Vendido' ? 'Venda fechada' : status.id === 'Perdido' ? (lead.notes || 'Negociação encerrada') : 'Sem próximo contato'}</div>}
                    <div className="lead-actions">
                      <button className="whatsapp-button" onClick={e => { e.stopPropagation(); openWhatsApp(lead); }}><MessageCircle size={16} /> Abrir WhatsApp</button>
                      <button className="icon-button" onClick={e => { e.stopPropagation(); openLead(lead); }}><MoreHorizontal size={18} /></button>
                    </div>
                  </article>
                ))}
                {columnLeads.length === 0 && <div className="empty-column">Arraste um lead para cá</div>}
              </div>
              <button className="add-column-lead" onClick={() => { setForm({ ...emptyForm, status: status.id }); setFormError(''); setModalOpen(true); }}><Plus size={15} /> Adicionar lead</button>
            </section>;
          })}
        </div>
      </section>
    </main>
  );

  const renderActivePage = () => {
    if (selectedLead) return renderLeadDetail();
    if (activePage === 'Dashboard') return <Dashboard leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => { setForm(emptyForm); setFormError(''); setModalOpen(true); }} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} />;
    if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} />;
    if (activePage === 'Mensagens' || activePage === 'Configurações') return <ComingSoon type={activePage} goDashboard={() => setActivePage('Dashboard')} />;
    return renderPipeline();
  };

  return (
    <div className="app-shell">
      {renderSidebar()}
      {renderActivePage()}

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <section className="modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2>Novo lead</h2><p>Adicione um novo contato ao pipeline.</p></div><button className="icon-button" onClick={() => setModalOpen(false)}><X size={20} /></button></div>
            <form onSubmit={addLead} className="lead-form">
              <label><span>Nome *</span><input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Studio Bella" /></label>
              <label><span>WhatsApp *</span><input required inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="21999999999" /></label>
              <label><span>Empresa</span><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Ex.: Salão de beleza" /></label>
              <label><span>Valor potencial</span><input type="number" min="0" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="350" /></label>
              <label><span>Status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.filter(status => !['Vendido', 'Perdido'].includes(status.id)).map(status => <option key={status.id}>{status.id}</option>)}</select></label>
              <label><span>Origem</span><select value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
              <label><span>Próximo contato</span><input type="date" value={form.nextContact} onChange={e => setForm({ ...form, nextContact: e.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={form.nextContactTime} onChange={e => setForm({ ...form, nextContactTime: e.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" /></label>
              <label className="full"><span>Observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Contexto da conversa..." /></label>
              {formError && <div className="auth-error full" role="alert">{formError}</div>}
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => { setModalOpen(false); setFormError(''); }}>Cancelar</button><button className="primary-button"><Plus size={16} /> Adicionar lead</button></div>
            </form>
          </section>
        </div>
      )}

      {pendingSale && (
        <div className="modal-backdrop" onMouseDown={() => { setPendingSale(null); setSaleError(''); }}>
          <section className="modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2>Fechar venda</h2><p>{pendingSale.name} · registre o valor que realmente foi fechado.</p></div><button className="icon-button" onClick={() => { setPendingSale(null); setSaleError(''); }}><X size={20} /></button></div>
            <form className="lead-form" onSubmit={confirmSale}>
              <label className="full"><span>Valor vendido *</span><input autoFocus type="number" min="0.01" step="0.01" value={pendingSale.value} onChange={e => setPendingSale({ ...pendingSale, value: e.target.value })} /></label>
              {saleError && <div className="auth-error full" role="alert">{saleError}</div>}
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => { setPendingSale(null); setSaleError(''); }}>Cancelar</button><button className="primary-button"><CheckCircle2 size={16} /> Confirmar venda</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
