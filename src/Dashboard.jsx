import React, { useMemo } from 'react';
import {
  ArrowRight,
  CircleDollarSign,
  Gauge,
  ListFilter,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
} from 'lucide-react';
import './dashboard.css';

const OPEN = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação'];
const FUNNEL = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado'];
const ORIGINS = ['Site', 'Indicação', 'WhatsApp', 'Google Maps', 'Instagram', 'Outro'];

const money = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function monthStart(offset = 0) {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function inRange(value, start, end) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date < end;
}

function pct(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function statusClass(status = '') {
  return status.toLowerCase().replaceAll(' ', '-');
}

function lostReason(lead) {
  const match = String(lead?.notes || '').match(/Motivo da perda:\s*([^\n]+)/i);
  return match?.[1]?.trim() || 'Sem motivo informado';
}

export default function Dashboard({ leads, goPipeline, goLeads, memberName }) {
  const data = useMemo(() => {
    const list = Array.isArray(leads) ? leads : [];
    const active = list.filter(lead => OPEN.includes(lead.status));
    const sold = list.filter(lead => lead.status === 'Fechado');
    const lost = list.filter(lead => lead.status === 'Perdido');
    const pipelineValue = active.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const soldValue = sold.reduce((sum, lead) => sum + Number(lead.saleValue || lead.value || 0), 0);
    const avgTicket = sold.length ? soldValue / sold.length : 0;
    const conversion = list.length ? Math.round((sold.length / list.length) * 100) : 0;

    const thisStart = monthStart(0);
    const nextStart = monthStart(1);
    const prevStart = monthStart(-1);
    const newThis = list.filter(lead => inRange(lead.createdAt, thisStart, nextStart));
    const newPrev = list.filter(lead => inRange(lead.createdAt, prevStart, thisStart));
    const soldThis = sold.filter(lead => inRange(lead.soldAt || lead.updatedAt, thisStart, nextStart));
    const soldPrev = sold.filter(lead => inRange(lead.soldAt || lead.updatedAt, prevStart, thisStart));
    const soldThisValue = soldThis.reduce((sum, lead) => sum + Number(lead.saleValue || lead.value || 0), 0);
    const soldPrevValue = soldPrev.reduce((sum, lead) => sum + Number(lead.saleValue || lead.value || 0), 0);

    const funnel = FUNNEL.map(status => ({
      status,
      count: list.filter(lead => lead.status === status).length,
      value: list.filter(lead => lead.status === status).reduce((sum, lead) => sum + Number(status === 'Fechado' ? (lead.saleValue || lead.value || 0) : (lead.value || 0)), 0),
    }));
    const maxFunnel = Math.max(1, ...funnel.map(item => item.count));

    const origins = ORIGINS.map(origin => {
      const items = list.filter(lead => (lead.origin || 'Outro') === origin);
      const wins = items.filter(lead => lead.status === 'Fechado');
      return {
        origin,
        count: items.length,
        wins: wins.length,
        value: wins.reduce((sum, lead) => sum + Number(lead.saleValue || lead.value || 0), 0),
        conversion: items.length ? Math.round((wins.length / items.length) * 100) : 0,
      };
    }).filter(item => item.count).sort((a, b) => b.value - a.value || b.count - a.count);

    const openStages = funnel.filter(item => OPEN.includes(item.status));
    const bottleneck = [...openStages].sort((a, b) => b.count - a.count)[0] || { status: 'Novo lead', count: 0 };

    const lossReasonMap = new Map();
    lost.forEach(lead => {
      const reason = lostReason(lead);
      lossReasonMap.set(reason, (lossReasonMap.get(reason) || 0) + 1);
    });
    const lossReasons = [...lossReasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const teamMap = new Map();
    list.forEach(lead => {
      const key = lead.assignedTo || 'unassigned';
      const current = teamMap.get(key) || { id: key, count: 0, wins: 0, value: 0 };
      current.count += 1;
      if (lead.status === 'Fechado') {
        current.wins += 1;
        current.value += Number(lead.saleValue || lead.value || 0);
      }
      teamMap.set(key, current);
    });
    const team = [...teamMap.values()].sort((a, b) => b.value - a.value || b.wins - a.wins).slice(0, 5);

    return {
      active,
      sold,
      lost,
      pipelineValue,
      soldValue,
      avgTicket,
      conversion,
      newThis,
      newPrev,
      soldThis,
      soldThisValue,
      newDelta: pct(newThis.length, newPrev.length),
      soldDelta: pct(soldThisValue, soldPrevValue),
      funnel,
      maxFunnel,
      origins,
      bottleneck,
      lossReasons,
      team,
    };
  }, [leads]);

  const cards = [
    { label: 'Pipeline aberto', value: money(data.pipelineValue), detail: `${data.active.length} oportunidades`, icon: CircleDollarSign, tone: 'blue', action: () => goPipeline() },
    { label: 'Fechado no mês', value: money(data.soldThisValue), detail: `${data.soldThis.length} vendas · ${data.soldDelta >= 0 ? '+' : ''}${data.soldDelta}% vs mês anterior`, icon: TrendingUp, tone: 'green', action: () => goPipeline('Fechado') },
    { label: 'Leads novos', value: data.newThis.length, detail: `${data.newDelta >= 0 ? '+' : ''}${data.newDelta}% vs mês anterior`, icon: UsersRound, tone: 'neutral', action: () => goLeads({ status: 'Novo lead' }) },
    { label: 'Conversão', value: `${data.conversion}%`, detail: `${data.sold.length} fechados de ${leads.length}`, icon: Target, tone: 'purple', action: () => goPipeline('Fechado') },
  ];

  return (
    <main className="main-content dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Visão de gestão</span>
          <h1>Resultados</h1>
          <p>Aqui você analisa o negócio. Para saber o que fazer agora, o Início resolve essa parte chata.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="secondary-button" onClick={() => goPipeline()}><ListFilter size={17} /> Abrir pipeline</button>
        </div>
      </header>

      <section className="dashboard-metrics" aria-label="Resultados comerciais">
        {cards.map(card => {
          const Icon = card.icon;
          return <button type="button" className="dashboard-metric-card results-card-button" key={card.label} onClick={card.action}><div className={`dashboard-metric-icon ${card.tone}`}><Icon size={18} /></div><div><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></div></button>;
        })}
      </section>

      <section className="results-grid-two">
        <div className="dashboard-panel">
          <div className="dashboard-panel-head"><div><h2>Funil de vendas</h2><p>Clique em qualquer etapa para abrir exatamente aqueles leads.</p></div></div>
          <div className="pipeline-bars">
            {data.funnel.map(item => (
              <button type="button" className="pipeline-bar-row" key={item.status} onClick={() => item.status === 'Fechado' ? goPipeline('Fechado') : goLeads({ status: item.status })}>
                <div className="pipeline-bar-label"><span className={`status-mini-dot status-${statusClass(item.status)}`} />{item.status}</div>
                <div className="pipeline-bar-track"><div className={`pipeline-bar-fill fill-${statusClass(item.status)}`} style={{ width: `${(item.count / data.maxFunnel) * 100}%` }} /></div>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="results-insight">
          <Gauge size={21} />
          <h3>Gargalo principal</h3>
          <p><strong>{data.bottleneck.status}</strong> concentra {data.bottleneck.count} lead{data.bottleneck.count === 1 ? '' : 's'} aberto{data.bottleneck.count === 1 ? '' : 's'}. Se muita gente estaciona aqui, vale revisar abordagem e próximo passo.</p>
          <button type="button" className="secondary-button" onClick={() => goLeads({ status: data.bottleneck.status })}>Ver esses leads <ArrowRight size={14} /></button>
        </aside>
      </section>

      <section className="results-grid-two">
        <div className="dashboard-panel">
          <div className="dashboard-panel-head"><div><h2>Origem dos leads</h2><p>Descubra de onde vêm os contatos que realmente fecham.</p></div></div>
          <div className="results-list">
            {data.origins.length ? data.origins.map(item => <button type="button" key={item.origin} onClick={() => goLeads({ origin: item.origin })}><div><strong>{item.origin}</strong><span>{item.count} leads · {item.wins} vendas · {item.conversion}% conversão</span></div><b>{money(item.value)}</b></button>) : <div className="dashboard-empty">Ainda não há dados de origem suficientes.</div>}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-head"><div><h2>Resumo financeiro</h2><p>Sem gráfico decorativo fingindo produtividade.</p></div></div>
          <div className="results-list">
            <button type="button" onClick={() => goPipeline('Fechado')}><div><strong>Total fechado</strong><span>{data.sold.length} vendas</span></div><b>{money(data.soldValue)}</b></button>
            <button type="button" onClick={() => goPipeline()}><div><strong>Valor em aberto</strong><span>{data.active.length} oportunidades</span></div><b>{money(data.pipelineValue)}</b></button>
            <button type="button" onClick={() => goPipeline('Fechado')}><div><strong>Ticket médio</strong><span>média das vendas fechadas</span></div><b>{money(data.avgTicket)}</b></button>
            <button type="button" onClick={() => goLeads({ status: 'Perdido' })}><div><strong>Leads perdidos</strong><span>{data.lossReasons[0] ? `Principal motivo: ${data.lossReasons[0].reason}` : 'revise padrões de perda'}</span></div><b>{data.lost.length}</b></button>
          </div>
        </div>
      </section>

      {data.lossReasons.length > 0 && (
        <section className="dashboard-panel" style={{ marginTop: 14 }}>
          <div className="dashboard-panel-head"><div><h2>Por que as vendas estão sendo perdidas?</h2><p>Motivos registrados quando um lead é marcado como perdido.</p></div><button type="button" onClick={() => goLeads({ status: 'Perdido' })}>Ver perdidos <ArrowRight size={14} /></button></div>
          <div className="results-list">
            {data.lossReasons.slice(0, 5).map(item => <button type="button" key={item.reason} onClick={() => goLeads({ status: 'Perdido' })}><div><strong>{item.reason}</strong><span>{item.count} lead{item.count === 1 ? '' : 's'} perdido{item.count === 1 ? '' : 's'}</span></div><b>{item.count}</b></button>)}
          </div>
        </section>
      )}

      {data.team.length > 1 && (
        <section className="dashboard-panel" style={{ marginTop: 14 }}>
          <div className="dashboard-panel-head"><div><h2>Equipe</h2><p>Desempenho por responsável.</p></div></div>
          <div className="results-list">
            {data.team.map((member, index) => <button type="button" key={member.id} onClick={() => goLeads({ assignee: member.id })}><div><strong>#{index + 1} · {member.id === 'unassigned' ? 'Sem responsável' : memberName(member.id)}</strong><span>{member.count} leads · {member.wins} vendas</span></div><b>{money(member.value)}</b></button>)}
          </div>
        </section>
      )}

      <section className="results-insight" style={{ marginTop: 14 }}>
        {data.soldDelta >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
        <h3>Leitura rápida</h3>
        <p>Entraram <strong>{data.newThis.length}</strong> leads neste mês e foram fechados <strong>{money(data.soldThisValue)}</strong>. O Dashboard agora serve para entender o que está acontecendo, não para duplicar a Central do Dia.</p>
      </section>
    </main>
  );
}
