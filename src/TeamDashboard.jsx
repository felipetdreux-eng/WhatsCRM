import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CircleDollarSign,
  Medal,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import './team-dashboard.css';

const WON_STATUSES = new Set(['Vendido', 'Fechado']);
const CLOSED_STATUSES = new Set(['Vendido', 'Fechado', 'Perdido']);

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function memberStats(member, leads, today) {
  const owned = leads.filter(lead => lead.assignedTo === member.user_id);
  const won = owned.filter(lead => WON_STATUSES.has(lead.status));
  const revenue = won.reduce((sum, lead) => sum + Number(lead.saleValue ?? lead.value ?? 0), 0);
  const due = owned.filter(lead => !CLOSED_STATUSES.has(lead.status) && lead.nextContact && lead.nextContact <= today);
  return {
    member,
    leads: owned.length,
    won: won.length,
    revenue,
    conversion: owned.length ? Math.round((won.length / owned.length) * 100) : 0,
    due: due.length,
  };
}

export default function TeamDashboard({ leads = [], members = [], currentUserId = null }) {
  const [scope, setScope] = useState('team');

  const data = useMemo(() => {
    const today = localDateKey();
    const safeMembers = Array.isArray(members) ? members : [];
    const memberRows = safeMembers
      .map(member => memberStats(member, leads, today))
      .sort((a, b) => b.won - a.won || b.revenue - a.revenue || b.leads - a.leads || a.member.name.localeCompare(b.member.name));

    const scopedLeads = scope === 'team' ? leads : leads.filter(lead => lead.assignedTo === scope);
    const won = scopedLeads.filter(lead => WON_STATUSES.has(lead.status));
    const revenue = won.reduce((sum, lead) => sum + Number(lead.saleValue ?? lead.value ?? 0), 0);
    const due = scopedLeads.filter(lead => !CLOSED_STATUSES.has(lead.status) && lead.nextContact && lead.nextContact <= today);
    const conversion = scopedLeads.length ? Math.round((won.length / scopedLeads.length) * 100) : 0;
    const unassigned = leads.filter(lead => !lead.assignedTo || !safeMembers.some(member => member.user_id === lead.assignedTo)).length;

    return {
      memberRows,
      scopedLeads,
      won,
      revenue,
      due,
      conversion,
      unassigned,
    };
  }, [leads, members, scope]);

  if (!members.length) return null;

  const selectedMember = members.find(member => member.user_id === scope);
  const scopeLabel = scope === 'team' ? 'Equipe inteira' : (selectedMember?.name || 'Membro');
  const leader = data.memberRows[0] || null;

  return (
    <section className="team-dashboard" aria-label="Dashboard da equipe">
      <div className="team-dashboard-head">
        <div>
          <span className="team-dashboard-kicker"><UsersRound size={14} /> Desempenho da equipe</span>
          <h2>Dashboard da equipe</h2>
          <p>Acompanhe distribuição de leads, vendas, conversão e follow-ups por responsável.</p>
        </div>
        {leader && leader.won > 0 && (
          <div className="team-leader-badge" title="Maior número de vendas fechadas">
            <Trophy size={16} />
            <span><small>Líder em vendas</small><strong>{leader.member.name}</strong></span>
          </div>
        )}
      </div>

      <div className="team-scope-tabs" role="tablist" aria-label="Filtrar dashboard por membro">
        <button type="button" className={scope === 'team' ? 'active' : ''} onClick={() => setScope('team')} role="tab" aria-selected={scope === 'team'}>
          Equipe inteira
        </button>
        {members.map(member => (
          <button
            type="button"
            key={member.user_id}
            className={scope === member.user_id ? 'active' : ''}
            onClick={() => setScope(member.user_id)}
            role="tab"
            aria-selected={scope === member.user_id}
          >
            {member.name}{member.user_id === currentUserId ? ' (você)' : ''}
          </button>
        ))}
      </div>

      <div className="team-scope-caption">Mostrando: <strong>{scopeLabel}</strong></div>

      <div className="team-metrics-grid">
        <article className="team-metric-card">
          <div className="team-metric-icon"><UserRound size={18} /></div>
          <div><span>Leads</span><strong>{data.scopedLeads.length}</strong><small>atribuídos neste workspace</small></div>
        </article>
        <article className="team-metric-card">
          <div className="team-metric-icon"><Medal size={18} /></div>
          <div><span>Vendas</span><strong>{data.won.length}</strong><small>negociações fechadas</small></div>
        </article>
        <article className="team-metric-card">
          <div className="team-metric-icon"><Target size={18} /></div>
          <div><span>Conversão</span><strong>{data.conversion}%</strong><small>vendas sobre leads</small></div>
        </article>
        <article className="team-metric-card">
          <div className="team-metric-icon"><CircleDollarSign size={18} /></div>
          <div><span>Faturamento</span><strong>{currency(data.revenue)}</strong><small>valor das vendas fechadas</small></div>
        </article>
        <article className={`team-metric-card ${data.due.length ? 'attention' : ''}`}>
          <div className="team-metric-icon"><CalendarClock size={18} /></div>
          <div><span>Follow-ups pendentes</span><strong>{data.due.length}</strong><small>vencidos ou para hoje</small></div>
        </article>
      </div>

      <div className="team-member-table-wrap">
        <div className="team-table-title">
          <div><strong>Desempenho por vendedor</strong><span>Leads são contados pelo responsável atual.</span></div>
          {data.unassigned > 0 && <b>{data.unassigned} sem responsável</b>}
        </div>
        <div className="team-member-table" role="table" aria-label="Desempenho dos membros">
          <div className="team-member-row team-member-header" role="row">
            <span>Membro</span><span>Leads</span><span>Vendas</span><span>Conversão</span><span>Faturamento</span><span>Follow-ups</span>
          </div>
          {data.memberRows.map((row, index) => (
            <button
              type="button"
              className={`team-member-row ${scope === row.member.user_id ? 'selected' : ''}`}
              key={row.member.user_id}
              onClick={() => setScope(row.member.user_id)}
              role="row"
              title={`Filtrar por ${row.member.name}`}
            >
              <span className="team-member-name">
                <i>{String(row.member.name || 'Membro').slice(0, 2).toUpperCase()}</i>
                <span><strong>{row.member.name}</strong><small>{row.member.user_id === currentUserId ? 'Você' : row.member.role === 'owner' ? 'Proprietário' : 'Membro'}</small></span>
                {index === 0 && row.won > 0 && <Trophy size={14} aria-label="Líder em vendas" />}
              </span>
              <strong>{row.leads}</strong>
              <strong>{row.won}</strong>
              <strong>{row.conversion}%</strong>
              <strong>{currency(row.revenue)}</strong>
              <strong className={row.due ? 'team-due-count' : ''}>{row.due}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
