import React, { useMemo } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ListFilter,
  MessageCircle,
  Plus,
  Target,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import './dashboard.css';

const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Vendido', 'Perdido'];

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function prettyDate(value) {
  if (!value) return 'Sem data';
  const today = dateKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateKey(tomorrowDate);
  if (value === today) return 'Hoje';
  if (value === tomorrow) return 'Amanhã';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function Dashboard({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps }) {
  const data = useMemo(() => {
    const active = leads.filter(lead => !['Vendido', 'Perdido'].includes(lead.status));
    const sold = leads.filter(lead => lead.status === 'Vendido');
    const interested = leads.filter(lead => lead.status === 'Interessado');
    const proposals = leads.filter(lead => lead.status === 'Proposta enviada');
    const soldValue = sold.reduce((sum, lead) => sum + Number(lead.saleValue || 0), 0);
    const salesWithoutValue = sold.filter(lead => !Number(lead.saleValue)).length;
    const potentialValue = active.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const conversion = leads.length ? Math.round((sold.length / leads.length) * 100) : 0;
    const today = dateKey();
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeek = dateKey(nextWeekDate);

    const followups = active
      .filter(lead => lead.nextContact)
      .sort((a, b) => `${a.nextContact}${a.nextContactTime || ''}`.localeCompare(`${b.nextContact}${b.nextContactTime || ''}`));

    const overdue = followups.filter(lead => lead.nextContact < today);
    const todayFollowups = followups.filter(lead => lead.nextContact === today);
    const weekFollowups = followups.filter(lead => lead.nextContact > today && lead.nextContact <= nextWeek);

    const statusCounts = STATUSES.map(status => ({
      status,
      count: leads.filter(lead => lead.status === status).length,
    }));
    const maxStatusCount = Math.max(1, ...statusCounts.map(item => item.count));
    const urgentTotal = overdue.length + todayFollowups.length;
    const recent = [...leads]
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
        if (a.createdAt) return -1;
        if (b.createdAt) return 1;
        return 0;
      })
      .slice(0, 5);

    return {
      active,
      sold,
      interested,
      proposals,
      soldValue,
      salesWithoutValue,
      potentialValue,
      conversion,
      overdue,
      todayFollowups,
      weekFollowups,
      statusCounts,
      maxStatusCount,
      urgentTotal,
      urgent: [...overdue, ...todayFollowups].slice(0, 5),
      recent,
    };
  }, [leads]);

  const cards = [
    { label: 'Leads', value: leads.length, detail: `${data.active.length} em negociação`, icon: UsersRound, tone: 'neutral' },
    { label: 'Interessados', value: data.interested.length, detail: 'leads aquecidos', icon: Target, tone: 'purple' },
    { label: 'Propostas', value: data.proposals.length, detail: 'aguardando decisão', icon: CircleDollarSign, tone: 'orange' },
    { label: 'Vendas', value: data.sold.length, detail: `${data.conversion}% de conversão`, icon: CheckCircle2, tone: 'green' },
    { label: 'Valor vendido', value: currency(data.soldValue), detail: data.salesWithoutValue ? `${data.salesWithoutValue} venda${data.salesWithoutValue > 1 ? 's' : ''} sem valor fechado` : 'valor efetivamente fechado', icon: TrendingUp, tone: 'green' },
    { label: 'Pipeline potencial', value: currency(data.potentialValue), detail: 'valor das oportunidades abertas', icon: CircleDollarSign, tone: 'blue' },
  ];

  return (
    <main className="main-content dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Visão geral</span>
          <h1>Dashboard</h1>
          <p>Veja o que precisa da sua atenção e onde estão suas próximas vendas.</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="secondary-button" onClick={goPipeline}><ListFilter size={17} /> Ver pipeline</button>
          <button className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="dashboard-metrics">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <article className="dashboard-metric-card" key={card.label}>
              <div className={`dashboard-metric-icon ${card.tone}`}><Icon size={18} /></div>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dashboard-attention">
        <div className="attention-copy">
          <div className="attention-icon"><CalendarClock size={22} /></div>
          <div>
            <span>Seu foco agora</span>
            <strong>
              {data.overdue.length > 0
                ? `${data.overdue.length} follow-up${data.overdue.length > 1 ? 's' : ''} atrasado${data.overdue.length > 1 ? 's' : ''}`
                : data.todayFollowups.length > 0
                  ? `${data.todayFollowups.length} follow-up${data.todayFollowups.length > 1 ? 's' : ''} para hoje`
                  : 'Nenhum follow-up urgente'}
            </strong>
            <p>{data.overdue.length > 0 ? 'Esses contatos já passaram da data e merecem prioridade.' : 'Mantenha o ritmo e não deixe nenhuma negociação esfriar.'}</p>
          </div>
        </div>
        <div className="attention-stats">
          <div><b>{data.overdue.length}</b><span>Atrasados</span></div>
          <div><b>{data.todayFollowups.length}</b><span>Hoje</span></div>
          <div><b>{data.weekFollowups.length}</b><span>Próx. 7 dias</span></div>
        </div>
        <button className="attention-button" onClick={goFollowUps}>Ver follow-ups <ArrowRight size={16} /></button>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel pipeline-overview">
          <div className="dashboard-panel-head">
            <div><h2>Pipeline</h2><p>Distribuição dos seus leads por etapa.</p></div>
            <button onClick={goPipeline}>Abrir pipeline <ArrowRight size={15} /></button>
          </div>
          <div className="pipeline-bars">
            {data.statusCounts.map(item => (
              <div className="pipeline-bar-row" key={item.status}>
                <div className="pipeline-bar-label"><span className={`status-mini-dot status-${item.status.toLowerCase().replaceAll(' ', '-')}`} />{item.status}</div>
                <div className="pipeline-bar-track"><div className={`pipeline-bar-fill fill-${item.status.toLowerCase().replaceAll(' ', '-')}`} style={{ width: `${(item.count / data.maxStatusCount) * 100}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <div className="conversion-row">
            <div className="conversion-number"><span>Taxa de conversão</span><strong>{data.conversion}%</strong></div>
            <div className="conversion-copy">{data.sold.length} venda{data.sold.length !== 1 ? 's' : ''} em {leads.length} lead{leads.length !== 1 ? 's' : ''}</div>
          </div>
        </section>

        <section className="dashboard-panel urgent-panel">
          <div className="dashboard-panel-head">
            <div><h2>Precisa de atenção</h2><p>Follow-ups vencidos ou marcados para hoje.</p></div>
            <span className="urgent-count">{data.urgentTotal}</span>
          </div>
          <div className="dashboard-list">
            {data.urgent.length ? data.urgent.map(lead => (
              <article className="dashboard-list-item" key={lead.id}>
                <button className="dashboard-lead-main" onClick={() => openLead(lead)}>
                  <div className="dashboard-avatar">{lead.name.slice(0, 2).toUpperCase()}</div>
                  <div><strong>{lead.name}</strong><span>{lead.nextAction || 'Retornar contato'}</span></div>
                </button>
                <div className="dashboard-list-meta">
                  <span className={lead.nextContact < dateKey() ? 'date-overdue' : 'date-today'}><Clock3 size={13} /> {prettyDate(lead.nextContact)}{lead.nextContactTime ? `, ${lead.nextContactTime}` : ''}</span>
                  <button title="Abrir WhatsApp" onClick={() => openWhatsApp(lead)}><MessageCircle size={16} /></button>
                </div>
              </article>
            )) : (
              <div className="dashboard-empty"><CheckCircle2 size={23} /><strong>Tudo em dia</strong><span>Nenhum follow-up urgente agora.</span></div>
            )}
          </div>
          <button className="dashboard-panel-footer" onClick={goFollowUps}>Ver todos os follow-ups <ArrowRight size={15} /></button>
        </section>
      </div>

      <section className="dashboard-panel recent-panel">
        <div className="dashboard-panel-head">
          <div><h2>Leads recentes</h2><p>Acesso rápido aos contatos adicionados mais recentemente.</p></div>
          <button onClick={goPipeline}>Ver todos <ArrowRight size={15} /></button>
        </div>
        <div className="recent-table-wrap">
          <table className="recent-table">
            <thead><tr><th>Cliente</th><th>Status</th><th>Origem</th><th>Valor</th><th>Próximo contato</th><th /></tr></thead>
            <tbody>
              {data.recent.map(lead => (
                <tr key={lead.id} onClick={() => openLead(lead)}>
                  <td><div className="recent-name"><div className="dashboard-avatar small">{lead.name.slice(0, 2).toUpperCase()}</div><div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span></div></div></td>
                  <td><span className={`recent-status status-${lead.status.toLowerCase().replaceAll(' ', '-')}`}>{lead.status}</span></td>
                  <td>{lead.origin || 'Outro'}</td>
                  <td><strong>{currency(lead.status === 'Vendido' ? lead.saleValue : lead.value)}</strong></td>
                  <td>{lead.nextContact ? prettyDate(lead.nextContact) : '—'}</td>
                  <td><button className="recent-whatsapp" onClick={event => { event.stopPropagation(); openWhatsApp(lead); }}><MessageCircle size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
