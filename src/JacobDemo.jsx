import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  LayoutDashboard,
  ListFilter,
  MessageCircle,
  MessagesSquare,
  Search,
  Settings,
  Target,
  UsersRound,
  XCircle,
} from 'lucide-react';
import Dashboard from './Dashboard';
import CentralDoDia from './CentralDoDia';
import LeadsPage from './LeadsPage';
import './styles.css';
import './dashboard.css';
import './leads.css';
import './messages.css';
import './jacob-demo.css';

const STATUSES = [
  { id: 'Novo lead', className: 'new' },
  { id: 'Contatado', className: 'contacted' },
  { id: 'Interessado', className: 'interested' },
  { id: 'Proposta enviada', className: 'proposal' },
  { id: 'Negociação', className: 'negotiation' },
  { id: 'Fechado', className: 'sold' },
  { id: 'Perdido', className: 'lost' },
];

const NAV_ITEMS = [
  ['Início', CalendarClock],
  ['Resultados', LayoutDashboard],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const dateKeyOffset = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const now = new Date().toISOString();
const daysAgo = days => new Date(Date.now() - days * 86400000).toISOString();

const INITIAL_LEADS = [
  { id: 'jacob-1', name: 'Reforma apto. Jardins', company: 'Cliente residencial', phone: '11999990001', status: 'Novo lead', value: 185000, origin: 'WhatsApp', nextContact: dateKeyOffset(0), nextContactTime: '14:30', nextAction: 'Entender escopo e metragem', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(0), updatedAt: now },
  { id: 'jacob-2', name: 'Retrofit escritório Vila Olímpia', company: 'Empresa de tecnologia', phone: '11999990002', status: 'Contatado', value: 420000, origin: 'Indicação', nextContact: dateKeyOffset(0), nextContactTime: '16:00', nextAction: 'Agendar visita técnica', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(2), updatedAt: daysAgo(1), lastFollowupAt: daysAgo(1) },
  { id: 'jacob-3', name: 'Reforma cobertura Moema', company: 'Cliente residencial', phone: '11999990003', status: 'Interessado', value: 310000, origin: 'Site', nextContact: dateKeyOffset(1), nextContactTime: '10:00', nextAction: 'Enviar estudo preliminar', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(4), updatedAt: daysAgo(2), lastFollowupAt: daysAgo(2) },
  { id: 'jacob-4', name: 'Adequação clínica Pinheiros', company: 'Clínica médica', phone: '11999990004', status: 'Proposta enviada', value: 265000, origin: 'Google Maps', nextContact: dateKeyOffset(2), nextContactTime: '09:30', nextAction: 'Confirmar análise da proposta', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(8), updatedAt: daysAgo(2), lastFollowupAt: daysAgo(2) },
  { id: 'jacob-5', name: 'Obra residencial Alphaville', company: 'Cliente residencial', phone: '11999990005', status: 'Negociação', value: 680000, origin: 'Indicação', nextContact: dateKeyOffset(2), nextContactTime: '15:00', nextAction: 'Revisar prazo e condições', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(11), updatedAt: daysAgo(1), lastFollowupAt: daysAgo(1) },
  { id: 'jacob-6', name: 'Reforma corporativa Itaim', company: 'Escritório jurídico', phone: '11999990006', status: 'Negociação', value: 540000, origin: 'WhatsApp', nextContact: dateKeyOffset(3), nextContactTime: '11:00', nextAction: 'Apresentar contraproposta', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(14), updatedAt: daysAgo(3), lastFollowupAt: daysAgo(3) },
  { id: 'jacob-7', name: 'Modernização apartamento Perdizes', company: 'Cliente residencial', phone: '11999990007', status: 'Fechado', value: 228000, saleValue: 228000, saleValueSource: 'confirmed', origin: 'Site', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Lead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(20), updatedAt: daysAgo(2), soldAt: daysAgo(2) },
  { id: 'jacob-8', name: 'Reforma loja Oscar Freire', company: 'Varejo premium', phone: '11999990008', status: 'Perdido', value: 195000, origin: 'Site', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Motivo da perda: prazo incompatível\nLead fictício para demonstração.', assignedTo: null, createdAt: daysAgo(18), updatedAt: daysAgo(6), lostAt: daysAgo(6) },
];

function statusTone(status) {
  if (status === 'Contatado') return 'blue';
  if (status === 'Interessado' || status === 'Negociação') return 'purple';
  if (status === 'Proposta enviada' || status === 'Perdido') return 'red';
  if (status === 'Fechado') return 'green';
  return 'neutral';
}

function DemoMessages({ leads, openWhatsApp }) {
  const [selectedId, setSelectedId] = useState(leads[0]?.id || '');
  const [query, setQuery] = useState('');
  const selected = leads.find(lead => lead.id === selectedId) || leads[0];
  const templates = [
    ['Primeiro contato', 'Prospecção', 'Olá! Tudo bem? Recebemos seu contato e queria entender melhor o projeto para conseguirmos orientar os próximos passos.'],
    ['Follow-up', 'Retorno', 'Olá! Passando para retomar nossa conversa e saber se conseguiu analisar o que combinamos.'],
    ['Proposta', 'Negociação', `Olá! A proposta do projeto está em ${selected ? currency(selected.value) : 'valor a definir'}. Posso esclarecer algum ponto para avançarmos?`],
    ['Última tentativa', 'Retorno', 'Olá! Passando uma última vez para saber se ainda faz sentido seguirmos com essa conversa.'],
  ].filter(([title, category]) => `${title} ${category}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="main-content messages-page">
      <header className="messages-header">
        <div><span className="messages-kicker">Mensagens</span><h1>Mensagens</h1><p>Modelos prontos para agilizar retornos comerciais.</p></div>
        <span className="jacob-demo-tag">Demonstração Jacob</span>
      </header>
      <div className="messages-controls">
        <label className="messages-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar modelo" /></label>
        <div className="messages-lead-finder">
          <span className="messages-control-label">Contato</span>
          <div className="messages-lead-picker"><select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{leads.filter(l => !['Fechado','Perdido'].includes(l.status)).map(lead => <option key={lead.id} value={lead.id}>{lead.name} · {lead.status}</option>)}</select></div>
          <span className="messages-lead-count">Dados fictícios usados apenas para demonstrar o fluxo.</span>
        </div>
      </div>
      <section className="messages-grid">
        {templates.map(([title, category, text]) => <article className="message-card" key={title}><div className="message-card-top"><div><span className="message-category">{category}</span><h2>{title}</h2></div></div><div className="message-preview">{text}</div><div className="message-actions"><button className="message-copy" type="button">Copiar</button><button className="message-send" type="button" onClick={() => openWhatsApp(selected)}>Abrir WhatsApp</button></div></article>)}
      </section>
    </main>
  );
}

export default function JacobDemo() {
  const [page, setPage] = useState('Início');
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const haystack = `${lead.name} ${lead.company} ${lead.phone} ${lead.origin} ${lead.status}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (statusFilter === 'Todos' || lead.status === statusFilter);
  }), [leads, query, statusFilter]);

  const metrics = STATUSES.map(status => {
    const items = filteredLeads.filter(lead => lead.status === status.id);
    const total = items.reduce((sum, lead) => sum + Number(status.id === 'Fechado' ? lead.saleValue || lead.value || 0 : lead.value || 0), 0);
    return { label: status.id, value: items.length, helper: status.id === 'Fechado' ? `${currency(total)} fechados` : `${currency(total)} em valor`, tone: statusTone(status.id), icon: status.id === 'Fechado' ? CheckCircle2 : status.id === 'Perdido' ? XCircle : Target };
  });

  const openWhatsApp = () => window.alert('Demonstração: no Fuply real, este botão abre o WhatsApp Web direto no contato selecionado.');
  const noop = () => {};

  const renderSidebar = () => (
    <aside className="sidebar">
      <button type="button" className="logo-wrap logo-button" onClick={() => setPage('Início')} aria-label="Ir para Início">
        <div className="logo-mark"><MessageCircle size={22} strokeWidth={2.4}/></div><span>Fuply</span>
      </button>
      <nav className="nav-list" aria-label="Navegação principal">
        {NAV_ITEMS.map(([label, Icon]) => <button type="button" key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => setPage(label)}><Icon size={18}/><span>{label}</span>{label === 'Leads' && <b className="nav-badge">2</b>}</button>)}
      </nav>
      <div className="profile-card"><div className="avatar">JE</div><div><strong>Jacob Engenharia</strong><span>Ambiente demonstrativo</span></div></div>
    </aside>
  );

  const renderPipeline = () => (
    <main className="main-content">
      <header className="page-header">
        <div><h1>Pipeline</h1><p>Organize seus clientes e não perca follow-ups.</p></div>
        <div className="header-actions"><label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente" /></label><select className="filter-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>Todos</option>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select><span className="jacob-demo-tag">Demonstração Jacob</span></div>
      </header>
      <section className="metrics-grid" aria-label="Resumo do pipeline">
        {metrics.map(metric => { const Icon = metric.icon; return <article className="metric-card" key={metric.label}><div className={`metric-icon ${metric.tone}`}><Icon size={18}/></div><div className="metric-copy"><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.helper}</small></div></article>; })}
      </section>
      <section className="pipeline-scroll" aria-label="Etapas do pipeline"><div className="pipeline-board">
        {STATUSES.map(status => { const items = filteredLeads.filter(lead => lead.status === status.id); return <section className={`pipeline-column ${status.className}`} key={status.id}><div className="column-header"><div><span className="status-dot"/><strong>{status.id}</strong></div><span className="count-pill">{items.length}</span></div><div className="column-body">{items.map(lead => <article className="lead-card" key={lead.id}><div className="lead-heading"><div><strong>{lead.name}</strong><span>{lead.company}</span></div></div><div className="lead-value">{currency(lead.status === 'Fechado' ? lead.saleValue : lead.value)}</div>{lead.nextAction && <div className="next-contact">{lead.nextAction}</div>}<span className="lead-tag">{lead.origin}</span></article>)}{!items.length && <div className="empty-column">Nenhum lead nesta etapa.</div>}</div></section>; })}
      </div></section>
      <div className="jacob-demo-footnote">Dados fictícios. A interface e o fluxo são os mesmos do produto Fuply.</div>
    </main>
  );

  const renderSettings = () => <main className="main-content"><header className="page-header"><div><h1>Configurações</h1><p>Preferências da conta e do workspace.</p></div><span className="jacob-demo-tag">Demonstração Jacob</span></header><section className="jacob-demo-settings-card"><strong>Jacob Engenharia</strong><span>Este ambiente demonstra a interface comercial do Fuply sem alterar dados reais.</span></section></main>;

  const renderPage = () => {
    if (page === 'Início') return <CentralDoDia leads={leads} openLead={noop} openWhatsApp={openWhatsApp} onNewLead={noop} goPipeline={() => setPage('Pipeline')} goFollowUps={() => setPage('Leads')} goAutopilot={noop} onReplyWithAI={noop}/>;
    if (page === 'Resultados') return <Dashboard leads={leads} goPipeline={() => setPage('Pipeline')} goLeads={() => setPage('Leads')} memberName={() => 'Equipe Jacob'}/>;
    if (page === 'Pipeline') return renderPipeline();
    if (page === 'Leads') return <LeadsPage leads={leads} setLeads={setLeads} openLead={noop} openWhatsApp={openWhatsApp} onNewLead={noop} updateLeadStatus={(id, status) => setLeads(current => current.map(lead => lead.id === id ? { ...lead, status } : lead))} onActivity={noop} preset={null}/>;
    if (page === 'Mensagens') return <DemoMessages leads={leads} openWhatsApp={openWhatsApp}/>;
    return renderSettings();
  };

  return <div className="app-shell jacob-real-demo">{renderSidebar()}{renderPage()}<div className="jacob-demo-global-note">Demonstração personalizada · dados fictícios</div></div>;
}
