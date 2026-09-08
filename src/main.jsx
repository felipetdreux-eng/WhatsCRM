import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Filter,
  LayoutDashboard,
  ListFilter,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import './styles.css';

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
  { id: '1', name: 'Studio Bella', company: 'Salão de beleza', phone: '21999999991', value: 350, status: 'Novo lead', origin: 'Google Maps', nextContact: '2026-09-09', notes: 'Primeiro contato pendente.' },
  { id: '2', name: 'Mercado Silva', company: 'Mercado', phone: '21999999992', value: 250, status: 'Novo lead', origin: 'Google Maps', nextContact: '2026-09-10', notes: '' },
  { id: '3', name: 'Pet Care Feliz', company: 'Pet shop', phone: '21999999993', value: 400, status: 'Novo lead', origin: 'Instagram', nextContact: '2026-09-09', notes: '' },
  { id: '4', name: 'Barbearia Prime', company: 'Barbearia', phone: '21999999994', value: 300, status: 'Contatado', origin: 'Google Maps', nextContact: '2026-09-10', notes: 'Mensagem enviada.' },
  { id: '5', name: 'Padaria do João', company: 'Padaria', phone: '21999999995', value: 500, status: 'Contatado', origin: 'Indicação', nextContact: '2026-09-10', notes: '' },
  { id: '6', name: 'João Fotografia', company: 'Estúdio de fotografia', phone: '21999999996', value: 600, status: 'Interessado', origin: 'Instagram', nextContact: '2026-09-09', notes: 'Gostou da proposta inicial.' },
  { id: '7', name: 'Ana Design', company: 'Design gráfico', phone: '21999999997', value: 450, status: 'Interessado', origin: 'Instagram', nextContact: '2026-09-10', notes: '' },
  { id: '8', name: 'Alpha Elétrica', company: 'Serviços elétricos', phone: '21999999998', value: 750, status: 'Proposta enviada', origin: 'Google Maps', nextContact: '2026-09-11', notes: 'Proposta enviada por WhatsApp.' },
  { id: '9', name: 'Oficina JM', company: 'Oficina mecânica', phone: '21999999999', value: 850, status: 'Proposta enviada', origin: 'Google Maps', nextContact: '2026-09-12', notes: '' },
  { id: '10', name: 'Personal Lucas', company: 'Personal trainer', phone: '21999999980', value: 600, status: 'Vendido', origin: 'Indicação', nextContact: '', notes: 'Cliente ativo.' },
  { id: '11', name: 'Restaurante Sabor', company: 'Restaurante', phone: '21999999981', value: 700, status: 'Vendido', origin: 'Site', nextContact: '', notes: 'Cliente ativo.' },
  { id: '12', name: 'Tech Solutions', company: 'TI e informática', phone: '21999999982', value: 400, status: 'Perdido', origin: 'Google Maps', nextContact: '', notes: 'Sem retorno.' },
  { id: '13', name: 'Academia Move', company: 'Academia', phone: '21999999983', value: 550, status: 'Perdido', origin: 'Instagram', nextContact: '', notes: 'Escolheu concorrente.' },
];

const navItems = [
  ['Dashboard', LayoutDashboard],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Follow-ups', CalendarClock],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];

const currency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);

function formatDate(value) {
  if (!value) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T12:00:00`);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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
  const [form, setForm] = useState({ name: '', company: '', phone: '', value: '', status: 'Novo lead', origin: 'Google Maps', nextContact: '', notes: '' });

  useEffect(() => {
    localStorage.setItem('zapflow-leads', JSON.stringify(leads));
  }, [leads]);

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const haystack = `${lead.name} ${lead.company} ${lead.phone} ${lead.origin} ${lead.status}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || lead.status === statusFilter;
    const matchesOrigin = originFilter === 'Todas' || lead.origin === originFilter;
    return matchesQuery && matchesStatus && matchesOrigin;
  }), [leads, query, statusFilter, originFilter]);

  const sold = leads.filter(lead => lead.status === 'Vendido');
  const interested = leads.filter(lead => lead.status === 'Interessado');
  const proposals = leads.filter(lead => lead.status === 'Proposta enviada');
  const soldValue = sold.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
  const potentialValue = leads.filter(lead => !['Vendido', 'Perdido'].includes(lead.status)).reduce((sum, lead) => sum + Number(lead.value || 0), 0);

  const metrics = [
    { label: 'Leads', value: leads.length, helper: '12%', icon: UserRound, tone: 'neutral' },
    { label: 'Interessados', value: interested.length, helper: '20%', icon: Target, tone: 'blue' },
    { label: 'Propostas', value: proposals.length, helper: '17%', icon: CircleDollarSign, tone: 'purple' },
    { label: 'Vendas', value: sold.length, helper: '33%', icon: TrendingUp, tone: 'green' },
    { label: 'Valor vendido', value: currency(soldValue), helper: '28%', icon: BarChart3, tone: 'green' },
    { label: 'Pipeline potencial', value: currency(potentialValue), helper: '14%', icon: Sparkles, tone: 'red' },
  ];

  const openWhatsApp = lead => {
    const phone = String(lead.phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer');
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
    const next = {
      id: crypto.randomUUID(),
      ...form,
      value: Number(form.value || 0),
    };
    setLeads(current => [next, ...current]);
    setForm({ name: '', company: '', phone: '', value: '', status: 'Novo lead', origin: 'Google Maps', nextContact: '', notes: '' });
    setModalOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-wrap">
          <div className="logo-mark"><MessageCircle size={22} strokeWidth={2.4} /></div>
          <span>ZapFlow</span>
        </div>

        <nav className="nav-list">
          {navItems.map(([label, Icon]) => (
            <button key={label} className={`nav-item ${label === 'Pipeline' ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Follow-ups' && <b className="nav-badge">3</b>}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar">FA</div>
          <div><strong>Felipe</strong><span>Plano gratuito</span></div>
          <ChevronDown size={16} />
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Pipeline</h1>
            <p>Organize seus clientes e não perca follow-ups.</p>
          </div>
          <div className="header-actions">
            <label className="search-box">
              <Search size={17} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente" />
            </label>
            <label className="filter-control">
              <Filter size={16} />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option>Todos</option>
                {STATUSES.map(status => <option key={status.id}>{status.id}</option>)}
              </select>
            </label>
            <label className="filter-control hide-tablet">
              <select value={originFilter} onChange={event => setOriginFilter(event.target.value)}>
                <option>Todas</option>
                {ORIGINS.map(origin => <option key={origin}>{origin}</option>)}
              </select>
            </label>
            <button className="primary-button" onClick={() => setModalOpen(true)}><Plus size={18} /> Novo lead</button>
          </div>
        </header>

        <section className="metrics-grid">
          {metrics.map(metric => {
            const Icon = metric.icon;
            return (
              <article className="metric-card" key={metric.label}>
                <div className={`metric-icon ${metric.tone}`}><Icon size={18} /></div>
                <div className="metric-copy">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small><TrendingUp size={13} /> {metric.helper} <em>vs. mês anterior</em></small>
                </div>
              </article>
            );
          })}
        </section>

        <section className="pipeline-scroll">
          <div className="pipeline-board">
            {STATUSES.map(status => {
              const columnLeads = filteredLeads.filter(lead => lead.status === status.id);
              return (
                <section
                  className={`pipeline-column ${status.className}`}
                  key={status.id}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => onDrop(status.id)}
                >
                  <div className="column-header">
                    <div><span className="status-dot" /><strong>{status.id}</strong></div>
                    <span className="count-pill">{columnLeads.length}</span>
                  </div>

                  <div className="column-body">
                    {columnLeads.map(lead => (
                      <article
                        className="lead-card"
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggedId(lead.id)}
                        onDragEnd={() => setDraggedId(null)}
                      >
                        <div className="lead-heading">
                          <div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span></div>
                          <button className="icon-button" aria-label="Mais opções"><MoreHorizontal size={18} /></button>
                        </div>
                        <b className="lead-value">{currency(lead.value)}</b>
                        {lead.nextContact ? (
                          <div className="next-contact"><CalendarClock size={14} /> Próximo contato: {formatDate(lead.nextContact)}</div>
                        ) : (
                          <div className={`lead-tag ${status.id === 'Vendido' ? 'success' : 'danger'}`}>
                            {status.id === 'Vendido' ? 'Cliente ativo' : (lead.notes || 'Sem retorno')}
                          </div>
                        )}
                        <div className="lead-actions">
                          <button className="whatsapp-button" onClick={() => openWhatsApp(lead)}><MessageCircle size={16} /> Abrir WhatsApp</button>
                          <button className="icon-button"><MoreHorizontal size={18} /></button>
                        </div>
                      </article>
                    ))}
                    {columnLeads.length === 0 && <div className="empty-column">Arraste um lead para cá</div>}
                  </div>

                  <button className="add-column-lead" onClick={() => {
                    setForm(current => ({ ...current, status: status.id }));
                    setModalOpen(true);
                  }}><Plus size={15} /> Adicionar lead</button>
                </section>
              );
            })}
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <section className="modal" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header"><div><h2>Novo lead</h2><p>Adicione um novo contato ao pipeline.</p></div><button className="icon-button" onClick={() => setModalOpen(false)}><X size={20} /></button></div>
            <form onSubmit={addLead} className="lead-form">
              <label><span>Nome *</span><input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Studio Bella" /></label>
              <label><span>WhatsApp *</span><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="21999999999" /></label>
              <label><span>Empresa</span><input value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} placeholder="Ex.: Salão de beleza" /></label>
              <label><span>Valor potencial</span><input type="number" min="0" value={form.value} onChange={event => setForm({ ...form, value: event.target.value })} placeholder="350" /></label>
              <label><span>Status</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>
              <label><span>Origem</span><select value={form.origin} onChange={event => setForm({ ...form, origin: event.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>
              <label className="full"><span>Próximo contato</span><input type="date" value={form.nextContact} onChange={event => setForm({ ...form, nextContact: event.target.value })} /></label>
              <label className="full"><span>Observações</span><textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Anotações sobre o cliente..." /></label>
              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancelar</button><button className="primary-button"><Plus size={17} /> Adicionar lead</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
