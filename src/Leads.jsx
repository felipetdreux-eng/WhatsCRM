import React, { useMemo, useState } from 'react';
import { CalendarClock, Filter, MessageCircle, Plus, Search, UsersRound } from 'lucide-react';
import './leads.css';

const STATUSES = ['Todos', 'Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Vendido', 'Perdido'];

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value || 0);

const statusClass = status => `status-${String(status || '').toLowerCase().replaceAll(' ', '-')}`;

export default function Leads({ leads, openLead, openWhatsApp, onNewLead }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');

  const filtered = useMemo(() => leads.filter(lead => {
    const text = `${lead.name} ${lead.company || ''} ${lead.phone || ''} ${lead.origin || ''}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (status === 'Todos' || lead.status === status);
  }), [leads, query, status]);

  return (
    <main className="main-content leads-page">
      <header className="leads-header">
        <div>
          <span className="leads-kicker"><UsersRound size={14} /> Base de clientes</span>
          <h1>Leads</h1>
          <p>Encontre qualquer contato, veja o estágio da negociação e abra o cliente em um clique.</p>
        </div>
        <button className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
      </header>

      <section className="leads-toolbar">
        <label className="leads-search">
          <Search size={17} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, empresa ou telefone" aria-label="Buscar leads" />
        </label>
        <label className="leads-filter">
          <Filter size={16} />
          <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar leads por status">
            {STATUSES.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <span className="leads-count">{filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}</span>
      </section>

      {filtered.length === 0 ? (
        <section className="leads-empty">
          <UsersRound size={28} />
          <h2>Nenhum lead encontrado</h2>
          <p>Ajuste a busca ou adicione um novo contato.</p>
        </section>
      ) : (
        <section className="leads-table-card">
          <div className="leads-table-wrap">
            <table className="leads-table">
              <thead>
                <tr><th>Cliente</th><th>Status</th><th>Valor</th><th>Origem</th><th>Próximo contato</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id} onClick={() => openLead(lead)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openLead(lead); }}>
                    <td>
                      <div className="leads-person">
                        <div className="leads-avatar">{lead.name.slice(0, 2).toUpperCase()}</div>
                        <div><strong>{lead.name}</strong><span>{lead.company || lead.phone || 'Sem empresa'}</span></div>
                      </div>
                    </td>
                    <td><span className={`leads-status ${statusClass(lead.status)}`}>{lead.status}</span></td>
                    <td><strong className="leads-value">{currency(lead.value)}</strong></td>
                    <td>{lead.origin || 'Não informado'}</td>
                    <td>{lead.nextContact ? <span className="leads-next"><CalendarClock size={14} /> {new Date(`${lead.nextContact}T12:00:00`).toLocaleDateString('pt-BR')}{lead.nextContactTime ? ` · ${lead.nextContactTime}` : ''}</span> : '—'}</td>
                    <td>
                      <button className="leads-whatsapp" onClick={event => { event.stopPropagation(); openWhatsApp(lead); }} aria-label={`Abrir WhatsApp de ${lead.name}`}>
                        <MessageCircle size={16} /><span>WhatsApp</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
