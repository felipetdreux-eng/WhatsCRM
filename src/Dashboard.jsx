import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ListFilter,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import Autopilot, { buildAutopilotQueue } from './Autopilot';
import './dashboard.css';

const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Vendido', 'Perdido'];
const PRIORITY_STATUS = {
  'Proposta enviada': 0,
  Interessado: 1,
  Contatado: 2,
  'Novo lead': 3,
};

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

function statusClass(status = '') {
  return status.toLowerCase().replaceAll(' ', '-');
}

function overdueLabel(value) {
  if (!value) return 'Sem data';
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${dateKey()}T12:00:00`);
  const days = Math.max(1, Math.round((today - target) / 86400000));
  return `${days} dia${days === 1 ? '' : 's'} atrasado${days === 1 ? '' : 's'}`;
}

function daysWithoutInteraction(lead) {
  const source = lead.lastFollowupAt || lead.updatedAt || lead.createdAt;
  if (!source) return 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export default function Dashboard({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps }) {
  const [autopilotOpen, setAutopilotOpen] = useState(false);

  const data = useMemo(() => {
    const active = leads.filter(lead => !['Vendido', 'Perdido'].includes(lead.status));
    const sold = leads.filter(lead => lead.status === 'Vendido');
    const soldValue = sold.reduce((sum, lead) => sum + Number(lead.saleValue || 0), 0);
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
    const withoutNextContact = active
      .filter(lead => !lead.nextContact)
      .sort((a, b) => {
        const statusDiff = (PRIORITY_STATUS[a.status] ?? 9) - (PRIORITY_STATUS[b.status] ?? 9);
        if (statusDiff) return statusDiff;
        return Number(b.value || 0) - Number(a.value || 0);
      });

    const cooling = active
      .map(lead => ({ lead, days: daysWithoutInteraction(lead) }))
      .filter(item => item.days >= 3)
      .sort((a, b) => b.days - a.days || Number(b.lead.value || 0) - Number(a.lead.value || 0));
    const cold = cooling.filter(item => item.days >= 7);

    const queue = [];
    const seen = new Set();
    const pushQueue = (items, priority, unwrap = false) => {
      items.forEach(item => {
        const lead = unwrap ? item.lead : item;
        if (seen.has(lead.id)) return;
        seen.add(lead.id);
        queue.push({ lead, priority, days: unwrap ? item.days : null });
      });
    };
    pushQueue(overdue, 'overdue');
    pushQueue(todayFollowups, 'today');
    pushQueue(withoutNextContact, 'unscheduled');
    pushQueue(cold, 'cold', true);
    pushQueue(cooling, 'cooling', true);
    pushQueue(weekFollowups, 'upcoming');

    const statusCounts = STATUSES.map(status => ({
      status,
      count: leads.filter(lead => lead.status === status).length,
    }));
    const maxStatusCount = Math.max(1, ...statusCounts.map(item => item.count));

    const recent = [...leads]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 5);

    const autopilotQueue = buildAutopilotQueue(leads);
    const autopilotHigh = autopilotQueue.filter(item => item.priority === 'high').length;
    const autopilotValue = autopilotQueue.reduce((sum, item) => sum + Number(item.lead.value || 0), 0);

    return {
      active,
      sold,
      soldValue,
      potentialValue,
      conversion,
      overdue,
      todayFollowups,
      weekFollowups,
      withoutNextContact,
      cooling,
      cold,
      statusCounts,
      maxStatusCount,
      queue: queue.slice(0, 7),
      recent,
      autopilotQueue,
      autopilotHigh,
      autopilotValue,
    };
  }, [leads]);

  const cards = [
    {
      label: 'Em negociação',
      value: data.active.length,
      detail: `${data.cooling.length} sem interação há 3+ dias`,
      icon: UsersRound,
      tone: 'neutral',
    },
    {
      label: 'Pipeline potencial',
      value: currency(data.potentialValue),
      detail: 'oportunidades abertas',
      icon: CircleDollarSign,
      tone: 'blue',
    },
    {
      label: 'Vendido',
      value: currency(data.soldValue),
      detail: `${data.sold.length} venda${data.sold.length === 1 ? '' : 's'} fechada${data.sold.length === 1 ? '' : 's'}`,
      icon: TrendingUp,
      tone: 'green',
    },
    {
      label: 'Conversão',
      value: `${data.conversion}%`,
      detail: `${data.sold.length} de ${leads.length} leads`,
      icon: Target,
      tone: 'purple',
    },
  ];

  const queueLabel = item => {
    if (item.priority === 'overdue') return overdueLabel(item.lead.nextContact);
    if (item.priority === 'today') return 'Hoje';
    if (item.priority === 'unscheduled') return 'Sem próximo contato';
    if (item.priority === 'cold' || item.priority === 'cooling') return `${item.days} dias sem interação`;
    return prettyDate(item.lead.nextContact);
  };

  return (
    <main className="main-content dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Central de vendas</span>
          <h1>Dashboard</h1>
          <p>Abra, veja quem precisa de resposta e avance suas negociações.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="secondary-button" onClick={goPipeline}><ListFilter size={17} /> Ver pipeline</button>
          <button type="button" className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="autopilot-dashboard" aria-label="Autopilot de vendas">
        <div className="autopilot-dashboard-main">
          <div className="autopilot-dashboard-icon"><Sparkles size={21} /></div>
          <div className="autopilot-dashboard-copy">
            <span>Seu dia no Autopilot</span>
            <h2>{data.autopilotQueue.length ? `${data.autopilotQueue.length} oportunidades merecem sua atenção` : 'Sua fila prioritária está limpa'}</h2>
            <p>{data.autopilotQueue.length ? 'O sistema ordenou quem você deveria revisar primeiro com base em atraso, estágio, valor e tempo sem interação.' : 'Nada urgente agora. Você pode focar em gerar novas oportunidades.'}</p>
            <div className="autopilot-dashboard-meta">
              <b>{data.autopilotHigh} prioridade{data.autopilotHigh === 1 ? '' : 's'} alta{data.autopilotHigh === 1 ? '' : 's'}</b>
              <b>{data.overdue.length} atrasada{data.overdue.length === 1 ? '' : 's'}</b>
              <b>{currency(data.autopilotValue)} em jogo</b>
            </div>
          </div>
        </div>
        <button type="button" className="autopilot-dashboard-button" onClick={() => setAutopilotOpen(true)}>
          <Sparkles size={16} /> {data.autopilotQueue.length ? `Começar ${data.autopilotQueue.length} ações` : 'Abrir Autopilot'} <ArrowRight size={15} />
        </button>
      </section>

      <section className="dashboard-metrics" aria-label="Resumo comercial">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <article className="dashboard-metric-card" key={card.label}>
              <div className={`dashboard-metric-icon ${card.tone}`}><Icon size={18} /></div>
              <div><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></div>
            </article>
          );
        })}
      </section>

      <section className="focus-shell">
        <div className="focus-main">
          <div className="focus-heading">
            <div>
              <span className="focus-kicker"><AlertCircle size={14} /> Prioridades</span>
              <h2>Seu foco agora</h2>
              <p>Atrasos primeiro. Depois, contatos sem próximo passo e negociações que estão esfriando.</p>
            </div>
            <button type="button" onClick={goFollowUps}>Ver todos <ArrowRight size={15} /></button>
          </div>

          <div className="focus-tabs" aria-label="Resumo de prioridades">
            <div className={data.overdue.length ? 'danger' : ''}><strong>{data.overdue.length}</strong><span>Atrasados</span></div>
            <div className={data.todayFollowups.length ? 'warning' : ''}><strong>{data.todayFollowups.length}</strong><span>Hoje</span></div>
            <div><strong>{data.withoutNextContact.length}</strong><span>Sem próximo contato</span></div>
            <div className={data.cooling.length ? 'cooling' : ''}><strong>{data.cooling.length}</strong><span>Esfriando</span></div>
          </div>

          <div className="focus-list">
            {data.queue.length ? data.queue.map(item => {
              const { lead, priority } = item;
              return (
                <article className="focus-item" key={lead.id}>
                  <button type="button" className="focus-lead" onClick={() => openLead(lead)} aria-label={`Abrir ${lead.name}`}>
                    <div className="dashboard-avatar">{lead.name.slice(0, 2).toUpperCase()}</div>
                    <div className="focus-lead-copy">
                      <div className="focus-name-line"><strong>{lead.name}</strong><span className={`focus-status status-${statusClass(lead.status)}`}>{lead.status}</span></div>
                      <span>{lead.nextAction || (priority === 'unscheduled' ? 'Definir próximo contato' : 'Retornar contato')}</span>
                    </div>
                  </button>
                  <div className="focus-value"><span>Potencial</span><strong>{currency(lead.value)}</strong></div>
                  <span className={`focus-due ${priority}`}><Clock3 size={13} /> {queueLabel(item)}{lead.nextContactTime && !['unscheduled', 'cold', 'cooling'].includes(priority) ? `, ${lead.nextContactTime}` : ''}</span>
                  <div className="focus-actions">
                    <button type="button" className="focus-open" onClick={() => openLead(lead)}>Abrir</button>
                    <button type="button" className="focus-whatsapp" title="Abrir WhatsApp" aria-label={`Abrir WhatsApp de ${lead.name}`} onClick={() => openWhatsApp(lead)}><MessageCircle size={17} /></button>
                  </div>
                </article>
              );
            }) : (
              <div className="dashboard-empty focus-empty"><CheckCircle2 size={25} /><strong>Nada urgente agora</strong><span>Seus follow-ups estão em dia. Hora de criar novas oportunidades.</span></div>
            )}
          </div>
        </div>

        <aside className="health-panel">
          <div className="health-head">
            <div className="health-icon"><CalendarClock size={20} /></div>
            <div><span>Saúde da carteira</span><strong>{data.active.length ? Math.max(0, Math.round(((data.active.length - data.overdue.length - data.withoutNextContact.length) / data.active.length) * 100)) : 100}% organizada</strong></div>
          </div>
          <p>Negociações com próximo passo definido e sem atraso.</p>
          <div className="health-progress"><span style={{ width: `${data.active.length ? Math.max(0, Math.round(((data.active.length - data.overdue.length - data.withoutNextContact.length) / data.active.length) * 100)) : 100}%` }} /></div>
          <div className="health-grid">
            <div><span>Em negociação</span><strong>{data.active.length}</strong></div>
            <div><span>Sem próximo passo</span><strong>{data.withoutNextContact.length}</strong></div>
            <div><span>Atrasados</span><strong>{data.overdue.length}</strong></div>
            <div><span>7+ dias sem interação</span><strong>{data.cold.length}</strong></div>
          </div>
          <button type="button" onClick={goFollowUps}>Organizar follow-ups <ArrowRight size={15} /></button>
        </aside>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel pipeline-overview">
          <div className="dashboard-panel-head"><div><h2>Pipeline</h2><p>Onde suas oportunidades estão agora.</p></div><button type="button" onClick={goPipeline}>Abrir pipeline <ArrowRight size={15} /></button></div>
          <div className="pipeline-bars">
            {data.statusCounts.map(item => (
              <div className="pipeline-bar-row" key={item.status}>
                <div className="pipeline-bar-label"><span className={`status-mini-dot status-${statusClass(item.status)}`} />{item.status}</div>
                <div className="pipeline-bar-track"><div className={`pipeline-bar-fill fill-${statusClass(item.status)}`} style={{ width: `${(item.count / data.maxStatusCount) * 100}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <div className="conversion-row"><div className="conversion-number"><span>Taxa de conversão</span><strong>{data.conversion}%</strong></div><div className="conversion-copy">{data.sold.length} venda{data.sold.length !== 1 ? 's' : ''} em {leads.length} lead{leads.length !== 1 ? 's' : ''}</div></div>
        </section>

        <section className="dashboard-panel recent-panel">
          <div className="dashboard-panel-head"><div><h2>Leads recentes</h2><p>Contatos adicionados por último.</p></div><button type="button" onClick={goFollowUps}>Ver todos <ArrowRight size={15} /></button></div>
          <div className="recent-list">
            {data.recent.length ? data.recent.map(lead => (
              <article className="recent-card" key={lead.id}>
                <button type="button" className="recent-main" onClick={() => openLead(lead)}><div className="dashboard-avatar small">{lead.name.slice(0, 2).toUpperCase()}</div><div><strong>{lead.name}</strong><span>{lead.company || lead.origin || 'Sem empresa'}</span></div></button>
                <div className="recent-meta"><span className={`recent-status status-${statusClass(lead.status)}`}>{lead.status}</span><strong>{currency(lead.status === 'Vendido' ? lead.saleValue : lead.value)}</strong></div>
                <button type="button" className="recent-whatsapp" aria-label={`Abrir WhatsApp de ${lead.name}`} onClick={() => openWhatsApp(lead)}><MessageCircle size={16} /></button>
              </article>
            )) : (
              <div className="dashboard-empty"><UsersRound size={23} /><strong>Nenhum lead ainda</strong><span>Adicione seu primeiro contato para começar.</span></div>
            )}
          </div>
        </section>
      </div>

      <Autopilot
        open={autopilotOpen}
        onClose={() => setAutopilotOpen(false)}
        leads={leads}
        openLead={openLead}
        openWhatsApp={openWhatsApp}
      />
    </main>
  );
}
