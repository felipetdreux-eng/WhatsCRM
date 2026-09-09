import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  BarChart3,
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
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import Dashboard from './Dashboard';
import FollowUps from './FollowUps';
import Leads from './Leads';
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
  { id: '1', name: 'Studio Bella', company: 'Salão de beleza', phone: '21999999991', value: 350, status: 'Novo lead', origin: 'Google Maps', nextContact: '2026-09-08', nextContactTime: '15:00', nextAction: 'Fazer primeiro contato', notes: 'Primeiro contato pendente.' },
  { id: '2', name: 'Mercado Silva', company: 'Mercado', phone: '21999999992', value: 250, status: 'Novo lead', origin: 'Google Maps', nextContact: '2026-09-09', nextContactTime: '', nextAction: 'Apresentar serviço', notes: '' },
  { id: '3', name: 'Pet Care Feliz', company: 'Pet shop', phone: '21999999993', value: 400, status: 'Novo lead', origin: 'Instagram', nextContact: '2026-09-07', nextContactTime: '16:30', nextAction: 'Enviar mensagem', notes: '' },
  { id: '4', name: 'Barbearia Prime', company: 'Barbearia', phone: '21999999994', value: 300, status: 'Contatado', origin: 'Google Maps', nextContact: '2026-09-08', nextContactTime: '11:00', nextAction: 'Perguntar se recebeu', notes: 'Mensagem enviada.' },
  { id: '5', name: 'Padaria do João', company: 'Padaria', phone: '21999999995', value: 500, status: 'Contatado', origin: 'Indicação', nextContact: '2026-09-10', nextContactTime: '14:00', nextAction: 'Retornar contato', notes: '' },
  { id: '6', name: 'João Fotografia', company: 'Estúdio de fotografia', phone: '21999999996', value: 600, status: 'Interessado', origin: 'Instagram', nextContact: '2026-09-08', nextContactTime: '10:00', nextAction: 'Mandar proposta', notes: 'Gostou da proposta inicial.' },
  { id: '7', name: 'Ana Design', company: 'Design gráfico', phone: '21999999997', value: 450, status: 'Interessado', origin: 'Instagram', nextContact: '2026-09-10', nextContactTime: '', nextAction: 'Alinhar escopo', notes: '' },
  { id: '8', name: 'Alpha Elétrica', company: 'Serviços elétricos', phone: '21999999998', value: 750, status: 'Proposta enviada', origin: 'Google Maps', nextContact: '2026-09-11', nextContactTime: '15:30', nextAction: 'Cobrar retorno da proposta', notes: 'Proposta enviada por WhatsApp.' },
  { id: '9', name: 'Oficina JM', company: 'Oficina mecânica', phone: '21999999999', value: 850, status: 'Proposta enviada', origin: 'Google Maps', nextContact: '2026-09-12', nextContactTime: '09:30', nextAction: 'Fazer follow-up', notes: '' },
  { id: '10', name: 'Personal Lucas', company: 'Personal trainer', phone: '21999999980', value: 600, status: 'Vendido', origin: 'Indicação', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Cliente ativo.' },
  { id: '11', name: 'Restaurante Sabor', company: 'Restaurante', phone: '21999999981', value: 700, status: 'Vendido', origin: 'Site', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Cliente ativo.' },
  { id: '12', name: 'Tech Solutions', company: 'TI e informática', phone: '21999999982', value: 400, status: 'Perdido', origin: 'Google Maps', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Sem retorno.' },
  { id: '13', name: 'Academia Move', company: 'Academia', phone: '21999999983', value: 550, status: 'Perdido', origin: 'Instagram', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Escolheu concorrente.' },
];

const navItems = [
  ['Dashboard', LayoutDashboard],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Follow-ups', CalendarClock],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];

const emptyForm = {
  name: '', company: '', phone: '', value: '', status: 'Novo lead', origin: 'Google Maps',
  nextContact: '', nextContactTime: '', nextAction: '', notes: '',
};

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value || 0);

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

function whatsappPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
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

  const sold = leads.filter(lead => lead.status === 'Vendido');
  const interested = leads.filter(lead => lead.status === 'Interessado');
  const proposals = leads.filter(lead => lead.status === 'Proposta enviada');
  const soldValue = sold.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
  const potentialValue = leads
    .filter(lead => !['Vendido', 'Perdido'].includes(lead.status))
    .reduce((sum, lead) => sum + Number(lead.value || 0), 0);
  const dueFollowups = leads.filter(lead => lead.nextContact && !['Vendido', 'Perdido'].includes(lead.status) && lead.nextContact <= localDateKey()).length;

  const metrics = [
    { label: 'Leads', value: leads.length, helper: '12%', icon: UserRound, tone: 'neutral' },
    { label: 'Interessados', value: interested.length, helper: '20%', icon: Target, tone: 'blue' },
    { label: 'Propostas', value: proposals.length, helper: '17%', icon: CircleDollarSign, tone: 'purple' },
    { label: 'Vendas', value: sold.length, helper: '33%', icon: TrendingUp, tone: 'green' },
    { label: 'Valor vendido', value: currency(soldValue), helper: '28%', icon: BarChart3, tone: 'green' },
    { label: 'Pipeline potencial', value: currency(potentialValue), helper: '14%', icon: Sparkles, tone: 'red' },
  ];

  const openWhatsApp = (lead, message = '') => {
    const phone = whatsappPhone(lead.phone);
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    window.open(`https://wa.me/${phone}${text}`, '_blank', 'noopener,noreferrer');
  };

  const moveLead = (id, status) => {
    setLeads(current => current.map(lead => lead.id === id ? { ...lead, status } : lead));
  };

  const onDrop = status => {
    if (!draggedId) return;
    moveLead(draggedId, status);
    setDraggedId(null);
  };

  const addLead = event => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    const next = { id: crypto.randomUUID(), ...form, value: Number(form.value || 0) };
    setLeads(current => [next, ...current]);
    setForm(emptyForm);
    setModalOpen(false);
  };

  const openLead = lead => {
    setSelectedLeadId(lead.id);
    setEditingLead(null);
  };

  const startEditing = () => {
    if (!selectedLead) return;
    setEditingLead({ ...selectedLead, value: selectedLead.value ?? '' });
  };

  const saveLead = event => {
    event.preventDefault();
    if (!editingLead?.name?.trim() || !editingLead?.phone?.trim()) return;
    setLeads(current => current.map(lead => lead.id === editingLead.id
      ? { ...editingLead, value: Number(editingLead.value || 0) }
      : lead));
    setEditingLead(null);
  };

  const setLeadStatus = status => {
    if (!selectedLead) return;
    moveLead(selectedLead.id, status);
    setEditingLead(null);
  };

  const navigate = label => {
    setActivePage(label);
    setSelectedLeadId(null);
    setEditingLead(null);
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
            {label === 'Follow-ups' && dueFollowups > 0 && <b className="nav-badge">{dueFollowups}</b>}
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
          <button className="back-button" onClick={() => { setSelectedLeadId(null); setEditingLead(null); }}>
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
          <div className="detail-value"><span>Valor potencial</span><strong>{currency(selectedLead.value)}</strong></div>
        </section>

        {editingLead ? (
          <section className="detail-card edit-card">
            <div className="section-heading"><div><h2>Editar cliente</h2><p>Atualize as informações e salve.</p></div></div>
            <form className="lead-form detail-edit-form" onSubmit={saveLead}>
              <label><span>Nome *</span><input value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} /></label>
              <label><span>WhatsApp *</span><input value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} /></label>
              <label><span>Empresa</span><input value={editingLead.company || ''} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} /></label>
              <label><span>Valor potencial</span><input type="number" min="0" value={editingLead.value} onChange={e => setEditingLead({ ...editingLead, value: e.target.value })} /></label>
              <label><span>Status</span><select value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value })}>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
              <label><span>Origem</span><select value={editingLead.origin || 'Outro'} onChange={e => setEditingLead({ ...editingLead, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
              <label><span>Próximo contato</span><input type="date" value={editingLead.nextContact || ''} onChange={e => setEditingLead({ ...editingLead, nextContact: e.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={editingLead.nextContactTime || ''} onChange={e => setEditingLead({ ...editingLead, nextContactTime: e.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={editingLead.nextAction || ''} onChange={e => setEditingLead({ ...editingLead, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" /></label>
              <label className="full"><span>Observações</span><textarea value={editingLead.notes || ''} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} /></label>
              <div className="modal-actions full">
                <button type="button" className="secondary-button" onClick={() => setEditingLead(null)}>Cancelar</button>
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
                  <button className="detail-action sold-action" onClick={() => setLeadStatus('Vendido')}><CheckCircle2 size={17} /> Marcar como vendido</button>
                  <button className="detail-action lost-action" onClick={() => setLeadStatus('Perdido')}><XCircle size={17} /> Marcar como perdido</button>
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
          <button className="primary-button" onClick={() => setModalOpen(true)}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="metrics-grid">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return <article className="metric-card" key={metric.label}>
            <div className={`metric-icon ${metric.tone}`}><Icon size={18} /></div>
            <div className="metric-copy"><span>{metric.label}</span><strong>{metric.value}</strong><small><TrendingUp size={13} /> {metric.helper} <em>vs. mês anterior</em></small></div>
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
                    <b className="lead-value">{currency(lead.value)}</b>
                    {lead.nextContact ? <div className="next-contact"><CalendarClock size={14} /> Próximo contato: {formatDate(lead.nextContact)}</div> : <div className={`lead-tag ${status.id === 'Vendido' ? 'success' : 'danger'}`}>{status.id === 'Vendido' ? 'Cliente ativo' : (lead.notes || 'Sem retorno')}</div>}
                    <div className="lead-actions">
                      <button className="whatsapp-button" onClick={e => { e.stopPropagation(); openWhatsApp(lead); }}><MessageCircle size={16} /> Abrir WhatsApp</button>
                      <button className="icon-button" onClick={e => { e.stopPropagation(); openLead(lead); }}><MoreHorizontal size={18} /></button>
                    </div>
                  </article>
                ))}
                {columnLeads.length === 0 && <div className="empty-column">Arraste um lead para cá</div>}
              </div>
              <button className="add-column-lead" onClick={() => { setForm({ ...emptyForm, status: status.id }); setModalOpen(true); }}><Plus size={15} /> Adicionar lead</button>
            </section>;
          })}
        </div>
      </section>
    </main>
  );

  const renderActivePage = () => {
    if (selectedLead) return renderLeadDetail();
    if (activePage === 'Dashboard') return <Dashboard leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => { setForm(emptyForm); setModalOpen(true); }} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Follow-ups')} />;
    if (activePage === 'Leads') return <Leads leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => { setForm(emptyForm); setModalOpen(true); }} />;
    if (activePage === 'Follow-ups') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} />;
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
              <label><span>Nome *</span><input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Studio Bella" /></label>
              <label><span>WhatsApp *</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="21999999999" /></label>
              <label><span>Empresa</span><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Ex.: Salão de beleza" /></label>
              <label><span>Valor potencial</span><input type="number" min="0" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="350" /></label>
              <label><span>Status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
              <label><span>Origem</span><select value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
              <label><span>Próximo contato</span><input type="date" value={form.nextContact} onChange={e => setForm({ ...form, nextContact: e.target.value })} /></label>
              <label><span>Horário</span><input type="time" value={form.nextContactTime} onChange={e => setForm({ ...form, nextContactTime: e.target.value })} /></label>
              <label className="full"><span>Próxima ação</span><input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" /></label>
              <label className="full"><span>Observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Contexto da conversa..." /></label>
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancelar</button><button className="primary-button"><Plus size={16} /> Adicionar lead</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
