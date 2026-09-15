import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Hand,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  Zap,
} from 'lucide-react';
import { currency } from './domain';
import { getLeadIntelligence } from './leadIntelligence';
import { getLeadTemperature } from './leadTemperature';
import './inbox.css';

const CLOSED = new Set(['Fechado', 'Perdido']);
const FILTERS = [
  ['Todas', 'Todas'],
  ['Radar', 'Radar'],
  ['Novos', 'Novos'],
  ['Negociações', 'Negociações'],
];

function initials(name) {
  const parts = String(name || 'Lead').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || 'LD').toUpperCase();
}

function firstName(name) {
  return String(name || 'cliente').trim().split(/\s+/)[0] || 'cliente';
}

function messageSuggestion(lead) {
  const name = firstName(lead?.name);
  if (lead?.status === 'Novo lead') {
    return 'Oi, ' + name + '! Vi que você entrou em contato. Quero entender melhor o que você precisa e te mostrar o caminho mais rápido. Posso te fazer duas perguntas?';
  }
  if (lead?.status === 'Interessado') {
    return 'Oi, ' + name + '! Para eu te indicar a melhor opção, posso confirmar qual é a sua prioridade agora? Aí eu já te passo o próximo passo mais objetivo.';
  }
  if (lead?.status === 'Proposta enviada') {
    return 'Oi, ' + name + '! Conseguiu olhar a proposta? Se ficou alguma dúvida ou se precisar ajustar algum ponto, posso resolver por aqui.';
  }
  if (lead?.status === 'Negociação') {
    return 'Oi, ' + name + '! Vamos fechar os próximos passos? Se me confirmar o que falta para avançarmos, eu organizo isso com você agora.';
  }
  return 'Oi, ' + name + '! Passando para retomar nossa conversa. Ainda faz sentido avançarmos com isso?';
}

function demoConversation(lead) {
  const name = firstName(lead?.name);
  if (lead?.status === 'Proposta enviada') {
    return [
      { id: 'in-1', side: 'inbound', time: '09:14', text: 'Oi! Recebi a proposta, mas ainda estou comparando algumas opções.' },
      { id: 'out-1', side: 'outbound', time: '09:18', text: 'Perfeito. Posso te ajudar a comparar os pontos principais e ajustar o que fizer sentido.' },
      { id: 'in-2', side: 'inbound', time: '09:22', text: 'Vou revisar hoje e te retorno.' },
    ];
  }
  if (lead?.status === 'Negociação') {
    return [
      { id: 'in-1', side: 'inbound', time: '10:02', text: 'Gostei da solução. Preciso alinhar só o próximo passo internamente.' },
      { id: 'out-1', side: 'outbound', time: '10:06', text: 'Ótimo. Deixo tudo organizado para você decidir com segurança.' },
      { id: 'in-2', side: 'inbound', time: '10:09', text: 'Pode me chamar amanhã para a gente fechar isso.' },
    ];
  }
  return [
    { id: 'in-1', side: 'inbound', time: 'agora', text: 'Olá! Quero entender melhor como vocês podem me ajudar.' },
    { id: 'out-1', side: 'outbound', time: 'agora', text: 'Claro, ' + name + '! Vou entender seu cenário e te orientar pelo melhor caminho.' },
  ];
}

function realConversation(lead) {
  const context = String(lead?.notes || '').trim();
  return [
    {
      id: 'system-context',
      side: 'system',
      time: '',
      text: context
        ? 'Contexto cadastrado no Fuply: ' + context
        : 'O histórico de WhatsApp ainda não está sincronizado neste workspace.',
    },
    {
      id: 'system-next',
      side: 'system',
      time: '',
      text: 'Abra o WhatsApp para continuar. O Fuply não afirma que uma mensagem foi enviada ou lida sem confirmação do canal.',
    },
  ];
}

export default function InboxPage({
  leads = [],
  openLead,
  openWhatsApp,
  onReplyWithAI,
  onStatusChange,
  demoMode = false,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [selectedLeadId, setSelectedLeadId] = useState(() => leads.find(lead => !CLOSED.has(lead.status))?.id || null);
  const [draft, setDraft] = useState('');
  const [outbox, setOutbox] = useState({});
  const [ownership, setOwnership] = useState({});
  const [toast, setToast] = useState('');

  const rankedLeads = useMemo(() => (Array.isArray(leads) ? leads : [])
    .filter(lead => !CLOSED.has(lead.status))
    .map(lead => ({
      lead,
      intelligence: getLeadIntelligence(lead),
      temperature: getLeadTemperature(lead),
    }))
    .sort((a, b) => {
      const aRisk = a.temperature?.atRisk ? 1 : 0;
      const bRisk = b.temperature?.atRisk ? 1 : 0;
      if (aRisk !== bRisk) return bRisk - aRisk;
      return (b.intelligence?.score || 0) - (a.intelligence?.score || 0);
    }), [leads]);

  const visibleLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rankedLeads.filter(item => {
      const lead = item.lead;
      const haystack = (lead.name + ' ' + (lead.company || '') + ' ' + (lead.phone || '') + ' ' + lead.status).toLowerCase();
      const matchesQuery = !term || haystack.includes(term);
      const matchesFilter = filter === 'Todas'
        || (filter === 'Radar' && item.temperature?.atRisk)
        || (filter === 'Novos' && lead.status === 'Novo lead')
        || (filter === 'Negociações' && ['Interessado', 'Proposta enviada', 'Negociação'].includes(lead.status));
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, rankedLeads]);

  useEffect(() => {
    if (!selectedLeadId || !visibleLeads.some(item => item.lead.id === selectedLeadId)) {
      setSelectedLeadId(visibleLeads[0]?.lead?.id || null);
    }
  }, [selectedLeadId, visibleLeads]);

  const selectedItem = visibleLeads.find(item => item.lead.id === selectedLeadId) || visibleLeads[0] || null;
  const selectedLead = selectedItem?.lead || null;
  const intelligence = selectedItem?.intelligence;
  const temperature = selectedItem?.temperature;
  const mode = selectedLead ? ownership[selectedLead.id] || 'ia' : 'ia';
  const suggestion = selectedLead ? messageSuggestion(selectedLead) : '';
  const messages = useMemo(() => {
    if (!selectedLead) return [];
    const base = demoMode ? demoConversation(selectedLead) : realConversation(selectedLead);
    return base.concat(outbox[selectedLead.id] || []);
  }, [demoMode, outbox, selectedLead]);

  const activeLeads = rankedLeads.length;
  const radarCount = rankedLeads.filter(item => item.temperature?.atRisk).length;
  const highPriorityCount = rankedLeads.filter(item => (item.intelligence?.score || 0) >= 60).length;
  const dueTodayCount = rankedLeads.filter(item => item.lead.nextContact && item.lead.nextContact <= new Date().toISOString().slice(0, 10)).length;

  const showToast = value => {
    setToast(value);
    window.setTimeout(() => setToast(''), 3800);
  };

  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Resposta copiada.');
    } catch {
      showToast('Não foi possível copiar. Selecione o texto para copiar.');
    }
  };

  const prepareWhatsApp = text => {
    if (!selectedLead || !text?.trim()) return;
    setOutbox(current => ({
      ...current,
      [selectedLead.id]: [
        ...(current[selectedLead.id] || []),
        { id: 'out-' + Date.now(), side: 'outbound', time: 'agora', text: text.trim(), meta: 'Preparada pelo Fuply · envio depende do WhatsApp' },
      ],
    }));
    setDraft('');
    openWhatsApp?.(selectedLead, text.trim(), { source: 'inbox-ai' });
  };

  const assumeConversation = () => {
    if (!selectedLead) return;
    const nextMode = mode === 'ia' ? 'human' : 'ia';
    setOwnership(current => ({ ...current, [selectedLead.id]: nextMode }));
    showToast(nextMode === 'human' ? 'Conversa transferida para atendimento humano.' : 'Agente Fuply reassumiu a conversa.');
  };

  return (
    <main className="main-content inbox-page">
      <header className="inbox-header">
        <div>
          <span className="inbox-kicker"><MessageCircle size={14} /> Atendimento inteligente</span>
          <h1>Inbox de WhatsApp</h1>
          <p>Converse, entenda a intenção e avance o lead sem perder o contexto.</p>
        </div>
        <div className="inbox-header-actions">
          <span className="inbox-channel-status"><span /> {demoMode ? 'Demonstração local' : 'Canal pronto para conectar'}</span>
          <button type="button" className="secondary-button" onClick={() => selectedLead && openLead?.(selectedLead)} disabled={!selectedLead}><UserRound size={16} /> Ver ficha</button>
        </div>
      </header>

      <section className="inbox-metrics" aria-label="Resumo do Inbox">
        <article className="inbox-metric-card"><div className="inbox-metric-icon green"><MessageCircle size={17} /></div><div><span>Conversas abertas</span><strong>{activeLeads}</strong><small>leads ativos</small></div></article>
        <article className="inbox-metric-card"><div className="inbox-metric-icon red"><AlertTriangle size={17} /></div><div><span>No Radar</span><strong>{radarCount}</strong><small>pedem retomada</small></div></article>
        <article className="inbox-metric-card"><div className="inbox-metric-icon purple"><Sparkles size={17} /></div><div><span>Prioridade alta</span><strong>{highPriorityCount}</strong><small>score Fuply ≥ 60</small></div></article>
        <article className="inbox-metric-card"><div className="inbox-metric-icon blue"><Clock3 size={17} /></div><div><span>Para hoje</span><strong>{dueTodayCount}</strong><small>follow-ups vencendo</small></div></article>
      </section>

      <section className="inbox-layout">
        <aside className="inbox-panel inbox-conversations">
          <div className="inbox-panel-heading">
            <div><h2>Conversas</h2><span>{visibleLeads.length} na fila atual</span></div>
            <span className="inbox-live-dot"><span /> ao vivo</span>
          </div>
          <label className="inbox-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar contato" aria-label="Buscar contato no Inbox" /></label>
          <div className="inbox-filter-tabs" role="tablist" aria-label="Filtros de conversas">
            {FILTERS.map(([label, value]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          <div className="inbox-conversation-list">
            {visibleLeads.map(item => {
              const lead = item.lead;
              const selected = lead.id === selectedLead?.id;
              return (
                <button type="button" className={'inbox-conversation-row' + (selected ? ' selected' : '')} key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                  <div className="inbox-row-avatar">{initials(lead.name)}</div>
                  <div className="inbox-row-main">
                    <div className="inbox-row-top"><strong>{lead.name}</strong><span>{lead.lastFollowupAt ? 'recente' : 'novo'}</span></div>
                    <p>{lead.nextAction || item.intelligence?.recommendedAction || 'Definir próximo passo'}</p>
                    <div className="inbox-row-bottom"><span className={'inbox-status-dot ' + (item.temperature?.level || 'hot')} /> <span>{item.temperature?.label || 'Quente'}</span><b>{item.intelligence?.score || 0}</b></div>
                  </div>
                  <ChevronRight size={15} className="inbox-row-arrow" />
                </button>
              );
            })}
            {!visibleLeads.length && <div className="inbox-empty-list"><MessageCircle size={22} /><strong>Nenhuma conversa encontrada</strong><span>Ajuste a busca ou abra um lead ativo.</span></div>}
          </div>
        </aside>

        <section className="inbox-panel inbox-thread">
          {selectedLead ? (
            <>
              <header className="inbox-thread-header">
                <div className="inbox-thread-person">
                  <div className="inbox-thread-avatar">{initials(selectedLead.name)}</div>
                  <div><h2>{selectedLead.name}</h2><span>{selectedLead.company || 'Sem empresa'} · {selectedLead.phone || 'Sem WhatsApp'}</span></div>
                </div>
                <div className="inbox-thread-actions">
                  <button type="button" className="icon-button" onClick={() => openLead?.(selectedLead)} title="Abrir ficha" aria-label="Abrir ficha do lead"><UserRound size={16} /></button>
                  <button type="button" className="inbox-whatsapp-button" onClick={() => openWhatsApp?.(selectedLead)}><MessageCircle size={15} /> WhatsApp</button>
                </div>
              </header>
              <div className="inbox-thread-toolbar">
                <label><span>Etapa</span><select value={selectedLead.status} onChange={event => onStatusChange?.(selectedLead.id, event.target.value)}>{['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'].map(status => <option key={status}>{status}</option>)}</select></label>
                <div className="inbox-assignee-pill"><UserRound size={14} /> Responsável atual</div>
                <span className={'inbox-ownership-pill ' + mode}>{mode === 'ia' ? <><Bot size={13} /> Agente Fuply</> : <><Hand size={13} /> Humano assumiu</>}</span>
              </div>
              <div className="inbox-thread-surface">
                <div className="inbox-day-divider"><span>{demoMode ? 'Prévia de demonstração' : 'Histórico do atendimento'}</span></div>
                {messages.map(message => (
                  <div className={'inbox-message-line ' + message.side} key={message.id}>
                    <div className="inbox-message-bubble">
                      <p>{message.text}</p>
                      {message.time && <span>{message.time}</span>}
                      {message.meta && <small>{message.meta}</small>}
                    </div>
                  </div>
                ))}
                <div className="inbox-channel-note"><ShieldCheck size={15} /><span>Proteção ativa: o Fuply só registra o que sabe. Envio e leitura dependem do WhatsApp.</span></div>
              </div>
              <div className="inbox-composer">
                <div className="inbox-quick-replies">
                  <span>Atalhos</span>
                  <button type="button" onClick={() => setDraft('Posso te mostrar o próximo passo mais indicado?')}>Próximo passo</button>
                  <button type="button" onClick={() => setDraft('Consigo te chamar em um horário que funcione para você?')}>Combinar retorno</button>
                </div>
                <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Escreva uma resposta ou use a sugestão da IA..." rows={3} />
                <div className="inbox-composer-footer"><span>Não envia sozinho. Você revisa antes de abrir o WhatsApp.</span><button type="button" className="inbox-send-button" onClick={() => prepareWhatsApp(draft)} disabled={!draft.trim()}><Send size={15} /> Preparar no WhatsApp</button></div>
              </div>
            </>
          ) : (
            <div className="inbox-no-selection"><MessageCircle size={30} /><h2>Escolha uma conversa</h2><p>Os leads ativos do seu pipeline aparecerão aqui.</p></div>
          )}
        </section>

        <aside className="inbox-context-column">
          {selectedLead ? (
            <>
              <section className="inbox-panel inbox-ai-card">
                <div className="inbox-ai-heading"><div className="inbox-ai-icon"><Sparkles size={17} /></div><div><span>Copiloto do atendimento</span><h2>Agente Fuply</h2></div><span className={'inbox-ai-state ' + mode}>{mode === 'ia' ? 'Ativo' : 'Pausado'}</span></div>
                <div className="inbox-score"><div><strong>{intelligence?.score || 0}</strong><span>/100</span></div><div><b>{intelligence?.label || 'Prioridade'}</b><small>{intelligence?.reason || 'Oportunidade ativa'}</small></div></div>
                <div className="inbox-score-bar"><span style={{ width: Math.max(5, Math.min(100, intelligence?.score || 0)) + '%' }} /></div>
                <div className="inbox-reasons">{(intelligence?.reasons || ['Contexto do lead em análise']).map(reason => <span key={reason}><CheckCircle2 size={13} /> {reason}</span>)}</div>
                <div className="inbox-suggestion"><div><span>Resposta sugerida</span><button type="button" onClick={() => copyText(suggestion)} title="Copiar sugestão" aria-label="Copiar sugestão"><Copy size={14} /></button></div><p>{suggestion}</p></div>
                <div className="inbox-ai-actions"><button type="button" className="inbox-ai-primary" onClick={() => prepareWhatsApp(suggestion)}><Zap size={15} /> Usar sugestão</button><button type="button" className="inbox-ai-secondary" onClick={() => onReplyWithAI?.(selectedLead)}><Sparkles size={15} /> Copiloto completo</button></div>
                <button type="button" className="inbox-handoff-button" onClick={assumeConversation}>{mode === 'ia' ? <><Hand size={15} /> Assumir conversa</> : <><Bot size={15} /> Devolver para IA</>}</button>
              </section>

              <section className="inbox-panel inbox-context-card">
                <div className="inbox-card-heading"><div><span>Contexto do CRM</span><h2>Ficha do lead</h2></div><button type="button" onClick={() => openLead?.(selectedLead)} aria-label="Abrir ficha do lead"><ChevronRight size={16} /></button></div>
                <div className="inbox-context-rows">
                  <div><Tag size={15} /><span>Origem</span><strong>{selectedLead.origin || 'Outro'}</strong></div>
                  <div><Phone size={15} /><span>WhatsApp</span><strong>{selectedLead.phone || 'Não informado'}</strong></div>
                  <div><Zap size={15} /><span>Potencial</span><strong>{currency(selectedLead.value)}</strong></div>
                  <div><Clock3 size={15} /><span>Próxima ação</span><strong>{selectedLead.nextContact ? (selectedLead.nextAction || 'Retomar contato') : 'Ainda não definida'}</strong></div>
                </div>
                {temperature?.atRisk && <div className="inbox-risk-note"><AlertTriangle size={14} /><span>{temperature.reason}</span></div>}
                <button type="button" className="inbox-open-lead" onClick={() => openLead?.(selectedLead)}>Abrir ficha completa <ArrowRight size={14} /></button>
              </section>

              <section className="inbox-guardrail-card">
                <div><ShieldCheck size={16} /><strong>Guardrails do atendimento</strong></div>
                <p>Opt-out, horário e revisão humana ficam previstos antes de qualquer automação real.</p>
                <small>O canal ainda precisa ser conectado para o envio automático.</small>
              </section>
            </>
          ) : <div className="inbox-panel inbox-empty-context"><Sparkles size={25} /><span>Selecione um lead para ver o contexto e a recomendação da IA.</span></div>}
        </aside>
      </section>

      {toast && <div className="inbox-toast" role="status">{toast}</div>}
    </main>
  );
}
