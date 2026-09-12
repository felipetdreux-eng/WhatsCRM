import React, { useMemo, useState } from 'react';
import { Building2, CalendarClock, CheckCircle2, LayoutDashboard, MessageCircle, Send, Target, UsersRound } from 'lucide-react';
import './jacob-demo.css';

const LEADS = [
  { id: 1, name: 'Reforma apto. Jardins', company: 'Cliente residencial', status: 'Novo lead', value: 185000, next: 'Entender escopo e metragem', date: 'Hoje, 14:30', owner: 'Comercial' },
  { id: 2, name: 'Retrofit escritório Vila Olímpia', company: 'Empresa de tecnologia', status: 'Contatado', value: 420000, next: 'Agendar visita técnica', date: 'Hoje, 16:00', owner: 'Engenharia' },
  { id: 3, name: 'Reforma cobertura Moema', company: 'Cliente residencial', status: 'Interessado', value: 310000, next: 'Enviar estudo preliminar', date: 'Amanhã, 10:00', owner: 'Projetos' },
  { id: 4, name: 'Adequação clínica Pinheiros', company: 'Clínica médica', status: 'Proposta enviada', value: 265000, next: 'Confirmar análise da proposta', date: 'Seg, 09:30', owner: 'Comercial' },
  { id: 5, name: 'Obra residencial Alphaville', company: 'Cliente residencial', status: 'Negociação', value: 680000, next: 'Revisar prazo e condições', date: 'Seg, 15:00', owner: 'Diretoria' },
  { id: 6, name: 'Reforma corporativa Itaim', company: 'Escritório jurídico', status: 'Negociação', value: 540000, next: 'Apresentar contraproposta', date: 'Ter, 11:00', owner: 'Comercial' },
  { id: 7, name: 'Modernização apartamento Perdizes', company: 'Cliente residencial', status: 'Fechado', value: 228000, next: 'Kickoff da obra', date: 'Qua, 09:00', owner: 'Obras' },
];

const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado'];
const currency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export default function JacobDemo() {
  const [page, setPage] = useState('Visão geral');
  const pipelineValue = useMemo(() => LEADS.filter(lead => lead.status !== 'Fechado').reduce((sum, lead) => sum + lead.value, 0), []);
  const closedValue = useMemo(() => LEADS.filter(lead => lead.status === 'Fechado').reduce((sum, lead) => sum + lead.value, 0), []);
  const negotiationCount = LEADS.filter(lead => lead.status === 'Negociação').length;

  return (
    <div className="jacob-demo-shell">
      <aside className="jacob-demo-sidebar">
        <div className="jacob-demo-brand"><div className="jacob-demo-logo">F</div><div><strong>Fuply</strong><span>Demo Jacob</span></div></div>
        <nav>
          {[
            ['Visão geral', LayoutDashboard],
            ['Pipeline', Target],
            ['Follow-ups', CalendarClock],
            ['Mensagens', MessageCircle],
          ].map(([label, Icon]) => (
            <button key={label} className={page === label ? 'active' : ''} onClick={() => setPage(label)}><Icon size={17}/><span>{label}</span></button>
          ))}
        </nav>
        <div className="jacob-demo-sidebar-note"><Building2 size={16}/><div><strong>Jacob Engenharia</strong><span>Ambiente demonstrativo</span></div></div>
      </aside>

      <main className="jacob-demo-main">
        <header className="jacob-demo-header">
          <div><span className="jacob-demo-kicker">Demonstração personalizada</span><h1>{page}</h1><p>Exemplo de como o Fuply pode organizar oportunidades, propostas e retornos da Jacob Engenharia.</p></div>
          <div className="jacob-demo-badge">Dados fictícios</div>
        </header>

        {page === 'Visão geral' && (
          <>
            <section className="jacob-demo-metrics">
              <article><div className="metric-icon"><UsersRound size={18}/></div><span>Oportunidades abertas</span><strong>{LEADS.filter(lead => lead.status !== 'Fechado').length}</strong><small>{currency(pipelineValue)} em potencial</small></article>
              <article><div className="metric-icon"><Target size={18}/></div><span>Em negociação</span><strong>{negotiationCount}</strong><small>{currency(LEADS.filter(l => l.status === 'Negociação').reduce((s,l) => s+l.value,0))}</small></article>
              <article><div className="metric-icon"><CalendarClock size={18}/></div><span>Follow-ups próximos</span><strong>5</strong><small>2 ainda hoje</small></article>
              <article><div className="metric-icon"><CheckCircle2 size={18}/></div><span>Fechado</span><strong>{currency(closedValue)}</strong><small>1 projeto ganho</small></article>
            </section>
            <section className="jacob-demo-two-col">
              <div className="jacob-demo-panel">
                <div className="panel-head"><div><strong>Prioridades comerciais</strong><span>O que merece atenção agora</span></div></div>
                <div className="priority-list">
                  {LEADS.filter(l => ['Negociação','Proposta enviada','Interessado'].includes(l.status)).map(lead => (
                    <div className="priority-item" key={lead.id}><div><strong>{lead.name}</strong><span>{lead.company} · {lead.status}</span></div><div><b>{currency(lead.value)}</b><small>{lead.next}</small></div></div>
                  ))}
                </div>
              </div>
              <div className="jacob-demo-panel">
                <div className="panel-head"><div><strong>Próximos retornos</strong><span>Nada fica perdido no WhatsApp</span></div></div>
                <div className="followup-list">
                  {LEADS.slice(0,5).map(lead => <div key={lead.id}><span className="followup-dot"/><div><strong>{lead.next}</strong><span>{lead.name}</span></div><b>{lead.date}</b></div>)}
                </div>
              </div>
            </section>
          </>
        )}

        {page === 'Pipeline' && (
          <section className="jacob-demo-pipeline-wrap">
            <div className="jacob-demo-pipeline">
              {STATUSES.map(status => {
                const items = LEADS.filter(lead => lead.status === status);
                return <div className="demo-column" key={status}><div className="demo-column-head"><strong>{status}</strong><span>{items.length}</span></div><div className="demo-column-body">{items.map(lead => <article className="demo-lead" key={lead.id}><span>{lead.company}</span><strong>{lead.name}</strong><b>{currency(lead.value)}</b><small>{lead.next}</small><em>{lead.owner}</em></article>)}{!items.length && <div className="demo-empty">Sem oportunidades</div>}</div></div>;
              })}
            </div>
          </section>
        )}

        {page === 'Follow-ups' && (
          <section className="jacob-demo-panel followup-page">
            <div className="panel-head"><div><strong>Agenda comercial</strong><span>Retornos programados por oportunidade</span></div></div>
            <div className="followup-table">
              {LEADS.filter(l => l.status !== 'Fechado').map(lead => <div key={lead.id}><div className="followup-date"><CalendarClock size={16}/><strong>{lead.date}</strong></div><div><strong>{lead.name}</strong><span>{lead.next}</span></div><span className="demo-status">{lead.status}</span><b>{lead.owner}</b></div>)}
            </div>
          </section>
        )}

        {page === 'Mensagens' && (
          <section className="jacob-demo-messages">
            <div className="jacob-demo-panel">
              <div className="panel-head"><div><strong>Contato selecionado</strong><span>Adequação clínica Pinheiros</span></div></div>
              <div className="contact-preview"><div className="avatar">AC</div><div><strong>Adequação clínica Pinheiros</strong><span>Proposta enviada · R$ 265 mil</span></div></div>
              <div className="message-demo-box">Olá! Tudo bem? Passando para saber se vocês conseguiram analisar a proposta da adequação da clínica. Se tiverem qualquer dúvida sobre escopo, prazo ou condições, posso esclarecer por aqui.</div>
              <button className="demo-whatsapp"><Send size={16}/> Abrir no WhatsApp</button>
            </div>
            <div className="jacob-demo-panel">
              <div className="panel-head"><div><strong>Modelos rápidos</strong><span>Mensagens que a equipe pode adaptar</span></div></div>
              <div className="template-list"><button>Primeiro contato<span>Apresentação e qualificação inicial</span></button><button>Follow-up de proposta<span>Retomar orçamento enviado</span></button><button>Agendar visita técnica<span>Confirmar data e responsável</span></button><button>Negociação<span>Revisar condições e próximos passos</span></button></div>
            </div>
          </section>
        )}

        <footer className="jacob-demo-footer">Demonstração conceitual com dados fictícios. Nenhum cliente ou projeto real da Jacob é exibido.</footer>
      </main>
    </div>
  );
}
