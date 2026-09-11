import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ListFilter,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
} from 'lucide-react';
import { buildCoolingWatchlist } from './leadTemperature';
import { buildSmartLeadList, getLeadIntelligence } from './leadIntelligence';
import { buildDuplicateIndex, duplicateGroupCount } from './duplicateLeads';
import './dashboard.css';
import './daily-pages.css';
import './daily-pages-dark.css';

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayDiff(value) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${dateKey()}T12:00:00`);
  return Math.round((target - today) / 86400000);
}

function recommendationFor(lead) {
  return getLeadIntelligence(lead)?.recommendedAction || lead.nextAction || 'Definir próximo passo';
}

export default function CentralDoDia({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps, goAutopilot, onReplyWithAI }) {
  const data = useMemo(() => {
    const list = Array.isArray(leads) ? leads : [];
    const active = list.filter(lead => !['Fechado', 'Perdido'].includes(lead.status));
    const today = dateKey();
    const overdue = active.filter(lead => lead.nextContact && lead.nextContact < today);
    const todayFollowups = active.filter(lead => lead.nextContact === today);
    const siteNew = active.filter(lead => lead.origin === 'Site' && lead.status === 'Novo lead');
    const cooling = buildCoolingWatchlist(active, { limit: Math.max(1, active.length) });
    const smart = buildSmartLeadList(active, { limit: Math.max(1, active.length), minScore: 60 });
    const duplicateIndex = buildDuplicateIndex(list);
    const duplicateGroups = duplicateGroupCount(duplicateIndex);

    const queue = [];
    const seen = new Set();
    const add = (lead, type, extra = {}) => {
      if (!lead || seen.has(lead.id)) return;
      seen.add(lead.id);
      queue.push({ lead, type, ...extra });
    };

    siteNew.sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).forEach(lead => add(lead, 'site'));
    overdue.sort((a, b) => String(a.nextContact).localeCompare(String(b.nextContact))).forEach(lead => add(lead, 'overdue'));
    todayFollowups.forEach(lead => add(lead, 'today'));
    smart.forEach(item => add(item.lead, 'smart', { intelligence: item.intelligence }));
    cooling.forEach(item => add(item.lead, 'cooling', { temperature: item.temperature }));

    const potential = active.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const withNextStep = active.filter(lead => lead.nextContact || ['Novo lead'].includes(lead.status)).length;
    const organized = active.length ? Math.round((withNextStep / active.length) * 100) : 100;

    const onboarding = {
      hasLead: list.length > 0,
      hasFollowup: list.some(lead => Boolean(lead.nextContact)),
      hasMoved: list.some(lead => lead.status && lead.status !== 'Novo lead'),
    };
    onboarding.complete = onboarding.hasLead && onboarding.hasFollowup && onboarding.hasMoved;

    return {
      active,
      overdue,
      todayFollowups,
      siteNew,
      cooling,
      smart,
      duplicateGroups,
      queue: queue.slice(0, 8),
      potential,
      organized,
      onboarding,
    };
  }, [leads]);

  const startDay = () => {
    if (data.queue[0]?.lead) openLead(data.queue[0].lead);
    else goPipeline();
  };

  const aiLead = data.queue[0]?.lead || data.active[0] || null;

  const typeLabel = item => {
    if (item.type === 'site') return 'Novo lead do site';
    if (item.type === 'overdue') return `${Math.abs(dayDiff(item.lead.nextContact) || 1)}d atrasado`;
    if (item.type === 'today') return 'Follow-up hoje';
    if (item.type === 'cooling') return 'Negociação esfriando';
    return item.intelligence?.label || 'Prioridade alta';
  };

  return (
    <main className="main-content dashboard-page daily-center-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Seu ponto de partida</span>
          <h1>Início</h1>
          <p>O Fuply já separou o que merece sua atenção. Você só precisa agir.</p>
        </div>
        <div className="dashboard-header-actions daily-secondary-actions">
          <button type="button" className="secondary-button" onClick={goAutopilot}><Sparkles size={17} /> Autopilot</button>
          <button type="button" className="secondary-button" onClick={goPipeline}><ListFilter size={17} /> Pipeline</button>
          <button type="button" className="primary-button" onClick={onNewLead}><Plus size={18} /> Novo lead</button>
        </div>
      </header>

      {!data.onboarding.complete && (
        <section className="onboarding-strip">
          <div className="onboarding-strip-head"><div><strong>Configure o básico enquanto usa</strong><br /><span>Sem tutorial de 14 telas. Faça as três ações e o Fuply aprende seu fluxo.</span></div></div>
          <div className="onboarding-steps">
            <button type="button" className={`onboarding-step ${data.onboarding.hasLead ? 'done' : ''}`} onClick={onNewLead}><b>{data.onboarding.hasLead ? <Check size={12} /> : '1'}</b><div><strong>Crie um lead</strong><span>Nome e WhatsApp bastam</span></div></button>
            <button type="button" className={`onboarding-step ${data.onboarding.hasFollowup ? 'done' : ''}`} onClick={goFollowUps}><b>{data.onboarding.hasFollowup ? <Check size={12} /> : '2'}</b><div><strong>Marque um follow-up</strong><span>Defina o próximo passo</span></div></button>
            <button type="button" className={`onboarding-step ${data.onboarding.hasMoved ? 'done' : ''}`} onClick={goPipeline}><b>{data.onboarding.hasMoved ? <Check size={12} /> : '3'}</b><div><strong>Avance uma venda</strong><span>Mude o estágio no pipeline</span></div></button>
          </div>
        </section>
      )}

      <section className="home-ai-spotlight">
        <div className="home-ai-icon"><Sparkles size={22} /></div>
        <div className="home-ai-copy">
          <span>Assistente de Vendas IA</span>
          <h2>Cliente respondeu? Descubra o que dizer para avançar a venda.</h2>
          <p>Cole a mensagem recebida e o Fuply identifica objeções, sugere estratégia e cria três respostas prontas para WhatsApp.</p>
        </div>
        <button type="button" className="home-ai-button" onClick={() => aiLead ? onReplyWithAI?.(aiLead) : goFollowUps({})}>
          <Sparkles size={16} /> {aiLead ? `Responder ${String(aiLead.name || '').split(' ')[0]} com IA` : 'Escolher um lead'}
        </button>
      </section>

      <section className="daily-hero">
        <div>
          <span><CalendarClock size={15} /> Seu dia em um lugar só</span>
          <h2>{data.queue.length ? `Você tem ${data.queue.length} coisas importantes agora` : 'Seu dia está limpo'}</h2>
          <p>{data.queue.length ? 'Leads novos, atrasos e oportunidades de maior valor estão ordenados para você.' : 'Nenhuma urgência. É um ótimo momento para gerar novas oportunidades.'}</p>
          <button type="button" className="start-day-button" onClick={startDay}>{data.queue.length ? 'Começar meu dia' : 'Abrir pipeline'} <ArrowRight size={15} /></button>
        </div>
        <div className="daily-health"><strong>{data.organized}%</strong><span>carteira organizada</span></div>
      </section>

      <section className="dashboard-metrics" aria-label="Resumo do dia">
        <button type="button" className="dashboard-metric-card results-card-button" onClick={() => goFollowUps({ scope: 'Atrasados' })}><div className="dashboard-metric-icon red"><AlertCircle size={18} /></div><div><span>Atrasados</span><strong>{data.overdue.length}</strong><small>precisam de ação</small></div></button>
        <button type="button" className="dashboard-metric-card results-card-button" onClick={() => goFollowUps({ scope: 'Hoje' })}><div className="dashboard-metric-icon blue"><Clock3 size={18} /></div><div><span>Para hoje</span><strong>{data.todayFollowups.length}</strong><small>follow-ups agendados</small></div></button>
        <button type="button" className="dashboard-metric-card results-card-button" onClick={() => goFollowUps({ scope: 'Inteligentes' })}><div className="dashboard-metric-icon purple"><Sparkles size={18} /></div><div><span>Prioridade alta</span><strong>{data.smart.length}</strong><small>ordenados pelo Fuply</small></div></button>
        <button type="button" className="dashboard-metric-card results-card-button" onClick={() => goFollowUps({ scope: 'Duplicados' })}><div className="dashboard-metric-icon neutral"><Copy size={18} /></div><div><span>Duplicados</span><strong>{data.duplicateGroups}</strong><small>{currency(data.potential)} no pipeline</small></div></button>
      </section>

      <section className="daily-priority-panel">
        <div className="dashboard-panel-head">
          <div><h2>O que fazer agora</h2><p>O sistema prioriza. Você executa. Um conceito revolucionário aparentemente.</p></div>
          <button type="button" onClick={() => goFollowUps({})}>Ver todos <ArrowRight size={15} /></button>
        </div>

        <div className="daily-action-list">
          {data.queue.length ? data.queue.map((item, index) => {
            const intelligence = item.intelligence || getLeadIntelligence(item.lead);
            return (
              <article className="daily-action-card" key={item.lead.id}>
                <span className="daily-order">{index + 1}</span>
                <button type="button" className="daily-lead" onClick={() => openLead(item.lead)}>
                  <div className="dashboard-avatar">{item.lead.name.slice(0, 2).toUpperCase()}</div>
                  <div><strong>{item.lead.name}</strong><span>{item.lead.status} · {recommendationFor(item.lead)}</span><span className="daily-smart-reason">{intelligence?.reason || typeLabel(item)}</span></div>
                </button>
                <div className="daily-due"><span className="daily-smart-badge"><Sparkles size={11} /> {intelligence?.score || 0}</span><strong>{typeLabel(item)}</strong><span>{currency(item.lead.value)} potencial</span></div>
                <div className="daily-actions">
                  <button type="button" onClick={() => openLead(item.lead)}>Abrir</button>
                  <button type="button" className="daily-whatsapp" onClick={() => openWhatsApp(item.lead)} aria-label={`Abrir WhatsApp de ${item.lead.name}`}><MessageCircle size={16} /></button>
                </div>
              </article>
            );
          }) : (
            <div className="dashboard-empty daily-empty"><CheckCircle2 size={28} /><strong>Dia organizado</strong><span>Nenhum follow-up urgente ou oportunidade crítica agora.</span></div>
          )}
        </div>
      </section>
    </main>
  );
}
