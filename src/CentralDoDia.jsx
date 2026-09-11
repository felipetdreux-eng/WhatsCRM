import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListFilter,
  MessageCircle,
  Plus,
  Snowflake,
  Target,
} from 'lucide-react';
import { buildCoolingWatchlist } from './leadTemperature';
import './dashboard.css';
import './daily-pages.css';
import './daily-pages-dark.css';

const PRIORITY_STATUS = {
  'Negociação': 0,
  'Proposta enviada': 1,
  Interessado: 2,
  Contatado: 3,
  'Novo lead': 4,
};

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function overdueLabel(value) {
  if (!value) return 'Sem data';
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${dateKey()}T12:00:00`);
  const days = Math.max(1, Math.round((today - target) / 86400000));
  return `${days} dia${days === 1 ? '' : 's'} atrasado${days === 1 ? '' : 's'}`;
}

function dueLabel(item) {
  if (item.priority === 'overdue') return overdueLabel(item.lead.nextContact);
  if (item.priority === 'today') return item.lead.nextContactTime ? `Hoje, ${item.lead.nextContactTime}` : 'Hoje';
  if (item.priority === 'unscheduled') return 'Sem próximo contato';
  if (item.priority === 'cooling') return `${item.days || 0} dias sem interação`;
  return 'Revisar negociação';
}

export default function CentralDoDia({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps }) {
  const data = useMemo(() => {
    const active = leads.filter(lead => !['Fechado', 'Perdido'].includes(lead.status));
    const today = dateKey();
    const followups = active
      .filter(lead => lead.nextContact)
      .sort((a, b) => `${a.nextContact}${a.nextContactTime || ''}`.localeCompare(`${b.nextContact}${b.nextContactTime || ''}`));
    const overdue = followups.filter(lead => lead.nextContact < today);
    const todayFollowups = followups.filter(lead => lead.nextContact === today);
    const withoutNextContact = active
      .filter(lead => !lead.nextContact)
      .sort((a, b) => {
        const statusDiff = (PRIORITY_STATUS[a.status] ?? 9) - (PRIORITY_STATUS[b.status] ?? 9);
        if (statusDiff) return statusDiff;
        return Number(b.value || 0) - Number(a.value || 0);
      });
    const cooling = buildCoolingWatchlist(active, { limit: Math.max(1, active.length) });

    const queue = [];
    const seen = new Set();
    const push = (items, priority, unwrap = false) => {
      items.forEach(item => {
        const lead = unwrap ? item.lead : item;
        if (!lead || seen.has(lead.id)) return;
        seen.add(lead.id);
        queue.push({ lead, priority, days: unwrap ? (item.temperature?.days ?? item.days ?? 0) : null });
      });
    };
    push(overdue, 'overdue');
    push(todayFollowups, 'today');
    push(withoutNextContact, 'unscheduled');
    push(cooling, 'cooling', true);

    const potential = active.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const organized = active.length
      ? Math.max(0, Math.round(((active.length - overdue.length - withoutNextContact.length) / active.length) * 100))
      : 100;

    return {
      active,
      overdue,
      todayFollowups,
      withoutNextContact,
      cooling,
      queue: queue.slice(0, 10),
      potential,
      organized,
    };
  }, [leads]);

  return (
    <main className="main-content dashboard-page daily-center-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Planejamento diário</span>
          <h1>Central do Dia</h1>
          <p>Veja o que precisa da sua atenção agora e termine o dia sem deixar venda escapar.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="secondary-button" onClick={goPipeline}><ListFilter size={17} /> Pipeline</button>
          <button type="button" className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      <section className="daily-hero">
        <div>
          <span><CalendarClock size={15} /> Seu dia em um lugar só</span>
          <h2>{data.queue.length ? `${data.queue.length} ações prioritárias para resolver` : 'Nenhuma urgência pendente'}</h2>
          <p>{data.queue.length ? 'Comece pelos atrasados, depois resolva os contatos de hoje e negociações sem próximo passo.' : 'Sua operação está organizada. Use o tempo livre para gerar novas oportunidades.'}</p>
        </div>
        <div className="daily-health"><strong>{data.organized}%</strong><span>carteira organizada</span></div>
      </section>

      <section className="dashboard-metrics" aria-label="Resumo do dia">
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon red"><AlertCircle size={18} /></div><div><span>Atrasados</span><strong>{data.overdue.length}</strong><small>precisam de ação</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon blue"><Clock3 size={18} /></div><div><span>Para hoje</span><strong>{data.todayFollowups.length}</strong><small>follow-ups agendados</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon purple"><Target size={18} /></div><div><span>Sem próximo passo</span><strong>{data.withoutNextContact.length}</strong><small>negociações abertas</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon neutral"><Snowflake size={18} /></div><div><span>Esfriando</span><strong>{data.cooling.length}</strong><small>{currency(data.potential)} no pipeline aberto</small></div></article>
      </section>

      <section className="daily-priority-panel">
        <div className="dashboard-panel-head">
          <div><h2>Fila de ação</h2><p>Uma ordem simples para você não decidir no improviso a cada cinco minutos.</p></div>
          <button type="button" onClick={goFollowUps}>Ver todos <ArrowRight size={15} /></button>
        </div>

        <div className="daily-action-list">
          {data.queue.length ? data.queue.map((item, index) => (
            <article className="daily-action-card" key={item.lead.id}>
              <span className="daily-order">{index + 1}</span>
              <button type="button" className="daily-lead" onClick={() => openLead(item.lead)}>
                <div className="dashboard-avatar">{item.lead.name.slice(0, 2).toUpperCase()}</div>
                <div><strong>{item.lead.name}</strong><span>{item.lead.status} · {item.lead.nextAction || 'Definir próximo passo'}</span></div>
              </button>
              <div className="daily-due"><strong>{dueLabel(item)}</strong><span>{currency(item.lead.value)} potencial</span></div>
              <div className="daily-actions">
                <button type="button" onClick={() => openLead(item.lead)}>Abrir</button>
                <button type="button" className="daily-whatsapp" onClick={() => openWhatsApp(item.lead)} aria-label={`Abrir WhatsApp de ${item.lead.name}`}><MessageCircle size={16} /></button>
              </div>
            </article>
          )) : (
            <div className="dashboard-empty daily-empty"><CheckCircle2 size={28} /><strong>Dia organizado</strong><span>Nenhum follow-up urgente ou negociação sem próximo passo.</span></div>
          )}
        </div>
      </section>
    </main>
  );
}
