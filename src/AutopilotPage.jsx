import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  MessageCircle,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import Autopilot, { buildAutopilotQueue } from './Autopilot';
import './dashboard.css';
import './daily-pages.css';

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function priorityLabel(priority) {
  if (priority === 'high') return 'Urgente';
  if (priority === 'medium') return 'Importante';
  return 'Revisar';
}

export default function AutopilotPage({ leads, openLead, openWhatsApp, onAutopilotOutcome }) {
  const [open, setOpen] = useState(false);
  const queue = useMemo(() => buildAutopilotQueue(leads), [leads]);
  const urgent = queue.filter(item => item.priority === 'high').length;
  const important = queue.filter(item => item.priority === 'medium').length;
  const value = queue.reduce((sum, item) => sum + Number(item.lead?.value || 0), 0);

  return (
    <main className="main-content dashboard-page autopilot-page-shell">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Automação de prioridades</span>
          <h1>Autopilot 2.0</h1>
          <p>O Fuply organiza quais negociações revisar primeiro e conduz uma ação por vez.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="primary-button" onClick={() => setOpen(true)}><WandSparkles size={18} /> Começar Autopilot</button>
        </div>
      </header>

      <section className="autopilot-page-hero">
        <div className="autopilot-page-icon"><Sparkles size={28} /></div>
        <div className="autopilot-page-copy">
          <span>Fila inteligente</span>
          <h2>{queue.length ? `${queue.length} oportunidades merecem atenção` : 'Sua fila prioritária está limpa'}</h2>
          <p>{queue.length ? 'A prioridade considera atraso, estágio da negociação, valor e tempo sem interação. Você resolve uma oportunidade, registra o resultado e segue para a próxima.' : 'Nenhuma oportunidade urgente agora. Você pode focar em prospectar e alimentar o pipeline.'}</p>
        </div>
        <button type="button" className="autopilot-page-start" onClick={() => setOpen(true)}>
          <Sparkles size={17} /> {queue.length ? `Iniciar ${queue.length} ações` : 'Abrir Autopilot'} <ArrowRight size={16} />
        </button>
      </section>

      <section className="dashboard-metrics" aria-label="Resumo do Autopilot">
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon red"><Flame size={18} /></div><div><span>Urgentes</span><strong>{urgent}</strong><small>prioridade alta</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon purple"><Target size={18} /></div><div><span>Importantes</span><strong>{important}</strong><small>pedem revisão</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon blue"><Sparkles size={18} /></div><div><span>Na fila</span><strong>{queue.length}</strong><small>ações recomendadas</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon green"><CheckCircle2 size={18} /></div><div><span>Valor em jogo</span><strong>{currency(value)}</strong><small>potencial priorizado</small></div></article>
      </section>

      <section className="autopilot-preview-panel">
        <div className="dashboard-panel-head">
          <div><h2>Próximas oportunidades</h2><p>Prévia da ordem que o Autopilot vai seguir.</p></div>
          <button type="button" onClick={() => setOpen(true)}>Começar agora <ArrowRight size={15} /></button>
        </div>

        <div className="autopilot-preview-list">
          {queue.length ? queue.slice(0, 7).map((item, index) => (
            <article className="autopilot-preview-card" key={item.lead.id}>
              <span className="autopilot-rank">{index + 1}</span>
              <button type="button" className="autopilot-preview-lead" onClick={() => openLead(item.lead)}>
                <div className="dashboard-avatar">{item.lead.name.slice(0, 2).toUpperCase()}</div>
                <div><strong>{item.lead.name}</strong><span>{item.lead.status} · {currency(item.lead.value)}</span></div>
              </button>
              <div className="autopilot-preview-reason">
                <strong className={`autopilot-priority ${item.priority}`}>{priorityLabel(item.priority)}</strong>
                <span>{item.reasons?.[0] || 'Revisar oportunidade'}</span>
              </div>
              <button type="button" className="autopilot-preview-whatsapp" onClick={() => openWhatsApp(item.lead)} aria-label={`Abrir WhatsApp de ${item.lead.name}`}><MessageCircle size={16} /></button>
            </article>
          )) : (
            <div className="dashboard-empty daily-empty"><CheckCircle2 size={28} /><strong>Nada urgente agora</strong><span>O Autopilot não encontrou oportunidades prioritárias.</span></div>
          )}
        </div>
      </section>

      <Autopilot
        open={open}
        onClose={() => setOpen(false)}
        leads={leads}
        openLead={openLead}
        openWhatsApp={openWhatsApp}
        onOutcome={onAutopilotOutcome}
      />
    </main>
  );
}
