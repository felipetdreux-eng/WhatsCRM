import React, { useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  ChevronRight,
  MessageCircle,
  Phone,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react';
import './leads.css';

const STATUSES = ['Todos', 'Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Vendido', 'Perdido'];

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value || 0);

const statusClass = status => `status-${String(status || '').toLowerCase().replaceAll(' ', '-')}`;

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone || 'Não informado';
}

function formatDate(date) {
  if (!date) return 'Sem próximo contato';
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function Leads({ leads, openLead, openWhatsApp, onNewLead }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');

  const filtered = useMemo(() => leads.filter(lead => {
    const text = `${lead.name} ${lead.company || ''} ${lead.phone || ''} ${lead.origin || ''} ${lead.status || ''}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (status === 'Todos' || lead.status === status);
  }), [leads, query, status]);

  const statusCounts = useMemo(() => STATUSES.reduce((acc, item) => {
    acc[item] = item === 'Todos' ? leads.length : leads.filter(lead => lead.status === item).length;
    return acc;
  }, {}), [leads]);

  return (
    <main className="main-content leads-page">
      <header className="leads-header">
        <div>
          <span className="leads-kicker"><UsersRound size={14} /> Base de contatos</span>
          <h1>Leads</h1>
          <p>Todos os seus contatos e negociações em uma única base.</p>
        </div>
        <button className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
      </header>

      <section className="leads-directory">
        <div className="leads-directory-top">
          <label className="leads-search">
            <Search size={17} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar nome, empresa, telefone ou origem"
              aria-label="Buscar leads"
            />
          </label>
          <span className="leads-result-count">{filtered.length} de {leads.length} contatos</span>
        </div>

        <div className="leads-status-tabs" role="tablist" aria-label="Filtrar por status">
          {STATUSES.map(item => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={status === item}
              className={status === item ? 'active' : ''}
              onClick={() => setStatus(item)}
            >
              <span>{item}</span>
              <b>{statusCounts[item]}</b>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="leads-empty">
            <UsersRound size={30} />
            <h2>Nenhum contato encontrado</h2>
            <p>Tente outro filtro ou adicione um novo lead.</p>
          </div>
        ) : (
          <>
            <div className="leads-desktop-table-wrap">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Empresa</th>
                    <th>Status</th>
                    <th>Origem</th>
                    <th>Valor</th>
                    <th>Próximo contato</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => openLead(lead)}
                      tabIndex={0}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openLead(lead);
                        }
                      }}
                    >
                      <td>
                        <div className="lead-contact-cell">
                          <div className="leads-avatar">{lead.name.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <strong>{lead.name}</strong>
                            <span><Phone size={12} /> {formatPhone(lead.phone)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="lead-company"><Building2 size={13} /> {lead.company || 'Sem empresa'}</span>
                      </td>
                      <td><span className={`leads-status ${statusClass(lead.status)}`}>{lead.status}</span></td>
                      <td><span className="lead-origin">{lead.origin || 'Não informado'}</span></td>
                      <td><strong className="leads-value">{currency(lead.value)}</strong></td>
                      <td>
                        <span className={`leads-next ${lead.nextContact ? '' : 'muted'}`}>
                          <CalendarClock size={14} />
                          {formatDate(lead.nextContact)}{lead.nextContactTime ? ` · ${lead.nextContactTime}` : ''}
                        </span>
                      </td>
                      <td>
                        <div className="lead-row-actions">
                          <button
                            className="leads-whatsapp"
                            onClick={event => { event.stopPropagation(); openWhatsApp(lead); }}
                            aria-label={`Abrir WhatsApp de ${lead.name}`}
                          >
                            <MessageCircle size={16} />
                          </button>
                          <button className="lead-open-button" onClick={event => { event.stopPropagation(); openLead(lead); }} aria-label={`Abrir ${lead.name}`}>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="leads-mobile-list">
              {filtered.map(lead => (
                <article className="lead-directory-card" key={lead.id} onClick={() => openLead(lead)}>
                  <div className="lead-directory-card-top">
                    <div className="lead-contact-cell">
                      <div className="leads-avatar">{lead.name.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <strong>{lead.name}</strong>
                        <span>{lead.company || 'Sem empresa'}</span>
                      </div>
                    </div>
                    <span className={`leads-status ${statusClass(lead.status)}`}>{lead.status}</span>
                  </div>

                  <div className="lead-directory-card-meta">
                    <span><Phone size={13} /> {formatPhone(lead.phone)}</span>
                    <span><Building2 size={13} /> {lead.origin || 'Origem não informada'}</span>
                    <span><CalendarClock size={13} /> {formatDate(lead.nextContact)}</span>
                  </div>

                  <div className="lead-directory-card-bottom">
                    <strong>{currency(lead.value)}</strong>
                    <div>
                      <button onClick={event => { event.stopPropagation(); openWhatsApp(lead); }} className="mobile-whatsapp"><MessageCircle size={16} /> WhatsApp</button>
                      <button onClick={event => { event.stopPropagation(); openLead(lead); }} className="mobile-open">Abrir <ChevronRight size={15} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
