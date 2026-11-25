import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Package, LogOut, MapPin, MessageCircle, Plus, Search, Settings, Trash2, Undo2, UsersRound, X } from 'lucide-react';
import OrderBuilder from './OrderBuilder';
import OrdersByNeighborhood from './OrdersByNeighborhood';
import SettingsPage from './SettingsPage';
import { cleanItems, itemsSummary, orderTotals } from './chefData';
import ProductTotals from './ProductTotals.jsx';
import { canonicalPhone, currency, validBrazilPhone, whatsappPhone } from './domain';
import { getActiveAccount, logoutAccount } from './accountStorage';
import { supabase } from './supabaseClient';
import './styles.css';
import './detail.css';
import './account.css';
import './usability.css';
import './order.css';

const ACTIVE_ACCOUNT = getActiveAccount();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const STATUS_PEDIDO = 'Pedido';
export const STATUS_ENVIADO = 'Enviado';
const STATUSES = [
  { id: STATUS_PEDIDO, className: 'new', title: 'Pedidos' },
  { id: STATUS_ENVIADO, className: 'sold', title: 'Enviados' },
];
const NAV_ITEMS = [
  ['Pipeline', ClipboardList],
  ['Por bairro', MapPin],
  ['Produtos', Package],
  ['Leads', UsersRound],
  ['Configurações', Settings],
];
const EMPTY_FORM = { name: '', phone: '', notes: '', items: [], neighborhood: '', deliveryFee: 0, value: 0 };

// Aceita pedidos salvos por versões anteriores: qualquer coisa que não seja "Enviado" volta a ser "Pedido".
function migrateLead(raw) {
  const lead = raw && typeof raw === 'object' ? raw : {};
  const sent = lead.status === STATUS_ENVIADO || lead.status === 'Confirmado' || lead.status === 'Fechado';
  const items = cleanItems(lead.items);
  const totals = orderTotals(items, lead.neighborhood);
  const value = items.length ? totals.total : (Number.isFinite(Number(lead.value)) ? Number(lead.value) : 0);
  return {
    ...lead,
    id: lead.id || crypto.randomUUID(),
    name: String(lead.name || 'Cliente sem nome'),
    company: String(lead.company || ''),
    phone: canonicalPhone(lead.phone),
    status: sent ? STATUS_ENVIADO : STATUS_PEDIDO,
    origin: lead.origin || 'Outro',
    notes: lead.notes || '',
    items,
    neighborhood: lead.neighborhood || '',
    deliveryFee: items.length ? totals.fee : (Number(lead.deliveryFee) || 0),
    value,
    saleValue: sent ? value : null,
    saleValueSource: sent ? 'confirmed' : null,
    soldAt: sent ? (lead.soldAt || lead.updatedAt || null) : null,
    lostAt: null,
    createdAt: lead.createdAt || null,
    updatedAt: lead.updatedAt || lead.createdAt || null,
  };
}

const migrateLeads = items => (Array.isArray(items) ? items.map(migrateLead) : []);
const formatDate = iso => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const initials = name => String(name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';

function OrderForm({ initial, submitLabel, onSubmit, onCancel, children }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');

  const submit = event => {
    event.preventDefault();
    if (!form.name.trim()) return setError('Informe o nome do cliente.');
    if (!validBrazilPhone(form.phone)) return setError('Digite um WhatsApp brasileiro válido com DDD.');
    if (!cleanItems(form.items).length) return setError('Escolha pelo menos um produto.');
    if (!form.neighborhood) return setError('Escolha o bairro de entrega.');
    setError('');
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="quick-lead-form">
      <label><span>Nome *</span><input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: João Silva" /></label>
      <label><span>WhatsApp *</span><input required inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="21999999999" /></label>
      <OrderBuilder items={form.items} neighborhood={form.neighborhood} onChange={order => setForm({ ...form, ...order })} />
      <label className="full"><span>Endereço e observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Rua, número, complemento, ponto de referência..." /></label>
      {error && <div className="auth-error full" role="alert">{error}</div>}
      <div className="modal-actions full">
        {children}
        <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
        <button className="primary-button">{submitLabel}</button>
      </div>
    </form>
  );
}

export default function App({ demoMode = false, demoAccount = null, demoLeads = null }) {
  const [account, setAccount] = useState(demoMode && demoAccount ? demoAccount : ACTIVE_ACCOUNT);
  const [leads, setLeads] = useState(() => {
    if (demoMode && Array.isArray(demoLeads)) return migrateLeads(demoLeads);
    try {
      return migrateLeads(JSON.parse(localStorage.getItem('zapflow-leads')));
    } catch {
      return [];
    }
  });
  const [activePage, setActivePage] = useState('Pipeline');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');

  // O backendBridge observa esta chave do localStorage e envia as mudanças pro Supabase.
  useEffect(() => {
    if (demoMode) return;
    localStorage.setItem('zapflow-leads', JSON.stringify(leads));
  }, [leads, demoMode]);

  useEffect(() => {
    if (demoMode) return undefined;
    const handleRemoteLeads = event => {
      if (Array.isArray(event?.detail?.leads)) setLeads(migrateLeads(event.detail.leads));
    };
    window.addEventListener('zapflow:remote-leads', handleRemoteLeads);
    return () => window.removeEventListener('zapflow:remote-leads', handleRemoteLeads);
  }, [demoMode]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const accountName = account?.name || 'Usuário';
  const editingLead = leads.find(lead => lead.id === editingId) || null;

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return leads;
    return leads.filter(lead => `${lead.name} ${lead.phone} ${lead.neighborhood} ${itemsSummary(lead.items)} ${lead.notes || ''}`.toLowerCase().includes(search));
  }, [leads, query]);

  const buildLead = (form, base = {}) => {
    const items = cleanItems(form.items);
    const totals = orderTotals(items, form.neighborhood);
    const now = new Date().toISOString();
    return migrateLead({
      ...base,
      id: base.id || crypto.randomUUID(),
      name: form.name.trim(),
      phone: canonicalPhone(form.phone),
      notes: form.notes || '',
      items,
      neighborhood: form.neighborhood,
      deliveryFee: totals.fee,
      value: totals.total,
      origin: base.origin || 'WhatsApp',
      status: base.status || STATUS_PEDIDO,
      createdAt: base.createdAt || now,
      updatedAt: now,
    });
  };

  const addOrder = form => {
    setLeads(current => [buildLead(form), ...current]);
    setCreating(false);
    setToast('Pedido criado.');
  };

  const saveOrder = form => {
    setLeads(current => current.map(lead => lead.id === editingId ? buildLead(form, lead) : lead));
    setEditingId(null);
    setToast('Pedido salvo.');
  };

  const setStatus = (id, status) => {
    const now = new Date().toISOString();
    setLeads(current => current.map(lead => lead.id !== id ? lead : migrateLead({
      ...lead,
      status,
      soldAt: status === STATUS_ENVIADO ? now : null,
      updatedAt: now,
    })));
    setToast(status === STATUS_ENVIADO ? 'Pedido marcado como enviado.' : 'Pedido voltou para a fila.');
  };

  const deleteOrder = async lead => {
    if (!window.confirm(`Excluir o pedido de ${lead.name}? Isso não pode ser desfeito.`)) return;
    if (!demoMode && UUID.test(lead.id)) {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) {
        console.error('Delete failed:', error);
        setToast('Não foi possível excluir. Tente de novo.');
        return;
      }
    }
    setLeads(current => current.filter(item => item.id !== lead.id));
    setEditingId(null);
    setToast('Pedido excluído.');
  };

  const handleLogout = () => {
    if (demoMode || !account?.id) { window.location.reload(); return; }
    logoutAccount(account.id);
    window.location.reload();
  };

  const [leadFilter, setLeadFilter] = useState('todos');
  const toSend = filtered.filter(l => l.status === STATUS_PEDIDO).length;
  const leadRows = useMemo(() => [...filtered].filter(l => leadFilter === 'todos' || (leadFilter === 'pedido' ? l.status === STATUS_PEDIDO : l.status === STATUS_ENVIADO)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')), [filtered, leadFilter]);

  const renderOrders = () => (
    <main className="main-content">
      <header className="page-header">
        <div><h1>Pipeline</h1><p>Marque como enviado quando o pedido sair.</p></div>
        <div className="header-actions">
          <label className="search-box"><Search size={17} /><span className="sr-only">Buscar pedidos</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pedido" aria-label="Buscar pedidos" /></label>
          <button type="button" className="primary-button" onClick={() => setCreating(true)}><Plus size={18} /> Novo pedido</button>
        </div>
      </header>

      <section className="metrics-grid" aria-label="Resumo">
        {STATUSES.map(status => {
          const list = filtered.filter(lead => lead.status === status.id);
          const amount = list.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
          return (
            <article className="metric-card" key={status.id}>
              <div className={`metric-icon ${status.id === STATUS_ENVIADO ? 'success' : 'neutral'}`}>{status.id === STATUS_ENVIADO ? <CheckCircle2 size={18} /> : <ClipboardList size={18} />}</div>
              <div className="metric-copy"><span>{status.title}</span><strong>{list.length}</strong><small>{currency(amount)}</small></div>
            </article>
          );
        })}
      </section>

      <section className="pipeline-scroll" aria-label="Pedidos">
        <div className="pipeline-board">
          {STATUSES.map(status => {
            const list = filtered.filter(lead => lead.status === status.id);
            return (
              <section className={`pipeline-column ${status.className}`} key={status.id}>
                <div className="column-header"><div><span className="status-dot" /><strong>{status.title}</strong></div><span className="count-pill">{list.length}</span></div>
                <div className="column-body">
                  {list.map(lead => (
                    <article className="lead-card" key={lead.id} onClick={() => setEditingId(lead.id)}>
                      <div className="lead-heading"><div><strong>{lead.name}</strong><span>{lead.neighborhood || 'Sem bairro'}</span></div></div>
                      <ul className="item-lines">{cleanItems(lead.items).map(item => <li key={item.productId}>{item.qty}× {item.name}</li>)}</ul>
                      <b className="lead-value">{currency(lead.value)}</b>
                      <div className="lead-actions">
                        {lead.status === STATUS_PEDIDO
                          ? <button type="button" className="whatsapp-button" onClick={e => { e.stopPropagation(); setStatus(lead.id, STATUS_ENVIADO); }}><CheckCircle2 size={16} /> Marcar como enviado</button>
                          : <button type="button" className="secondary-button" onClick={e => { e.stopPropagation(); setStatus(lead.id, STATUS_PEDIDO); }}><Undo2 size={16} /> Voltar pra fila</button>}
                      </div>
                    </article>
                  ))}
                  {list.length === 0 && <div className="empty-column">Nenhum pedido aqui</div>}
                </div>
                {status.id === STATUS_PEDIDO && <button type="button" className="add-column-lead" onClick={() => setCreating(true)}><Plus size={15} /> Novo pedido</button>}
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );

  const renderCustomers = () => (
    <main className="main-content">
      <header className="page-header">
        <div><h1>Leads</h1><p>{toSend} a enviar · {filtered.length - toSend} enviados</p></div>
        <div className="header-actions">
          <label className="search-box"><Search size={17} /><span className="sr-only">Buscar leads</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar lead" aria-label="Buscar leads" /></label>
        </div>
      </header>
      <div className="orders-toggle" role="group" aria-label="Filtrar por status">
        {[['todos', 'Todos'], ['pedido', 'A enviar'], ['enviado', 'Enviados']].map(([id, label]) => (
          <button type="button" key={id} className={`lead-filter ${leadFilter === id ? 'active' : ''}`} onClick={() => setLeadFilter(id)}>{label}</button>
        ))}
      </div>
      <section className="orders-production">
        {leadRows.length === 0 ? <p className="orders-empty">Nenhum lead ainda.</p> : (
          <table>
            <thead><tr><th align="left">Cliente</th><th align="left">WhatsApp</th><th align="left">Itens</th><th align="left">Bairro</th><th align="right">Total</th><th align="left">Status</th><th /></tr></thead>
            <tbody>
              {leadRows.map(lead => (
                <tr key={lead.id} onClick={() => setEditingId(lead.id)} style={{ cursor: 'pointer' }}>
                  <td>{lead.name}</td><td>{lead.phone} <a href={`https://wa.me/${whatsappPhone(lead.phone)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} aria-label="Abrir WhatsApp"><MessageCircle size={14} /></a></td><td><ul className="item-lines">{cleanItems(lead.items).map(item => <li key={item.productId}>{item.qty}× {item.name}</li>)}</ul></td><td>{lead.neighborhood}</td><td align="right" style={{ whiteSpace: 'nowrap' }}>{currency(lead.value)}</td><td><b style={{ color: lead.status === STATUS_ENVIADO ? '#0f9d63' : '#b45309' }}>{lead.status}</b></td>
                  <td align="right">
                    {lead.status === STATUS_PEDIDO
                      ? <button type="button" className="whatsapp-button" onClick={e => { e.stopPropagation(); setStatus(lead.id, STATUS_ENVIADO); }}><CheckCircle2 size={16} /> Marcar como enviado</button>
                      : <button type="button" className="secondary-button" onClick={e => { e.stopPropagation(); setStatus(lead.id, STATUS_PEDIDO); }}><Undo2 size={16} /> Voltar pra fila</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );


  const renderPage = () => {
    if (activePage === 'Por bairro') return <OrdersByNeighborhood leads={leads} openLead={lead => setEditingId(lead.id)} onMarkSent={id => setStatus(id, STATUS_ENVIADO)} />;
    if (activePage === 'Produtos') return <ProductTotals leads={leads} />;
    if (activePage === 'Leads') return renderCustomers();
    if (activePage === 'Configurações') return <SettingsPage account={account} onAccountChange={setAccount} onLogout={handleLogout} demoMode={demoMode} />;
    return renderOrders();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="logo-wrap logo-button" onClick={() => setActivePage('Pipeline')} aria-label="Ir para Pipeline">
          <div className="logo-mark"><MessageCircle size={22} strokeWidth={2.4} /></div>
          <span>Fuply</span>
        </button>
        <nav className="nav-list" aria-label="Navegação principal">
          {NAV_ITEMS.map(([label, Icon]) => (
            <button type="button" key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} onClick={() => setActivePage(label)} aria-current={activePage === label ? 'page' : undefined}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="profile-card">
          <div className="avatar" aria-hidden="true">{initials(accountName)}</div>
          <div><strong>{accountName}</strong></div>
          <button type="button" className="profile-logout icon-button" onClick={handleLogout} title="Sair da conta" aria-label="Sair da conta"><LogOut size={16} /></button>
        </div>
      </aside>
      <button type="button" className="mobile-logout" onClick={handleLogout} aria-label="Sair da conta" title="Sair"><LogOut size={16} /></button>

      {renderPage()}

      {toast && <div className="undo-toast" role="status"><span>{toast}</span></div>}

      {creating && (
        <div className="modal-backdrop" onMouseDown={() => setCreating(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2 id="new-order-title">Novo pedido</h2><p>Escolha o bairro e o que o cliente comprou.</p></div><button type="button" className="icon-button" onClick={() => setCreating(false)} aria-label="Fechar"><X size={20} /></button></div>
            <OrderForm initial={EMPTY_FORM} submitLabel="Adicionar pedido" onSubmit={addOrder} onCancel={() => setCreating(false)} />
          </section>
        </div>
      )}

      {editingLead && (
        <div className="modal-backdrop" onMouseDown={() => setEditingId(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-order-title" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header"><div><h2 id="edit-order-title">Pedido de {editingLead.name}</h2><p>{editingLead.status === STATUS_ENVIADO ? 'Já enviado' : 'Aguardando envio'}{editingLead.createdAt ? ` · criado em ${formatDate(editingLead.createdAt)}` : ''}</p></div><button type="button" className="icon-button" onClick={() => setEditingId(null)} aria-label="Fechar"><X size={20} /></button></div>
            <OrderForm key={editingLead.id} initial={{ ...EMPTY_FORM, name: editingLead.name, phone: editingLead.phone, notes: editingLead.notes, items: editingLead.items, neighborhood: editingLead.neighborhood, deliveryFee: editingLead.deliveryFee, value: editingLead.value }} submitLabel="Salvar" onSubmit={saveOrder} onCancel={() => setEditingId(null)}>
              <button type="button" className="secondary-button" onClick={() => deleteOrder(editingLead)}><Trash2 size={16} /> Excluir</button>
              {editingLead.status === STATUS_PEDIDO
                ? <button type="button" className="secondary-button" onClick={() => { setStatus(editingLead.id, STATUS_ENVIADO); setEditingId(null); }}><CheckCircle2 size={16} /> Marcar como enviado</button>
                : <button type="button" className="secondary-button" onClick={() => { setStatus(editingLead.id, STATUS_PEDIDO); setEditingId(null); }}><Undo2 size={16} /> Voltar pra fila</button>}
            </OrderForm>
          </section>
        </div>
      )}
    </div>
  );
}
