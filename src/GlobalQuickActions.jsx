import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, LayoutDashboard, ListFilter, MessageCircle, Plus, Search, Sparkles, UsersRound, X } from 'lucide-react';

const COMMANDS = [
  { id: 'home', label: 'Ir para Início', hint: 'Central do Dia', icon: CalendarClock },
  { id: 'reply-ai', label: 'Responder cliente com IA', hint: 'analise a mensagem e gere a resposta', icon: Sparkles },
  { id: 'results', label: 'Ver Resultados', hint: 'desempenho e funil', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Abrir Pipeline', hint: 'todas as negociações', icon: ListFilter },
  { id: 'overdue', label: 'Mostrar atrasados', hint: 'follow-ups vencidos', icon: UsersRound },
  { id: 'smart', label: 'Mostrar leads prioritários', hint: 'score inteligente', icon: Sparkles },
  { id: 'autopilot', label: 'Abrir Autopilot', hint: 'assistente de follow-up', icon: Sparkles },
];

export default function GlobalQuickActions({ leads, onNewLead, onNavigate, onOpenLead, onOpenLeads, onReplyWithAI }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [aiSelect, setAiSelect] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(value => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setAiSelect(false);
      setQuery('');
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return (Array.isArray(leads) ? leads : []).slice(0, 6);
    return (Array.isArray(leads) ? leads : [])
      .filter(lead => `${lead.name} ${lead.company || ''} ${lead.phone || ''} ${lead.status || ''} ${lead.origin || ''} ${lead.notes || ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [leads, query]);

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(command => `${command.label} ${command.hint}`.toLowerCase().includes(q));
  }, [query]);

  const runCommand = id => {
    if (id === 'reply-ai') {
      setAiSelect(true);
      setQuery('');
      return;
    }
    setOpen(false);
    setQuery('');
    if (id === 'home') return onNavigate('Início');
    if (id === 'results') return onNavigate('Resultados');
    if (id === 'pipeline') return onNavigate('Pipeline');
    if (id === 'overdue') return onOpenLeads({ scope: 'Atrasados' });
    if (id === 'smart') return onOpenLeads({ scope: 'Inteligentes' });
    if (id === 'autopilot') return onNavigate('Autopilot 2.0');
  };

  const openLead = lead => {
    setOpen(false);
    setQuery('');
    if (aiSelect) onReplyWithAI?.(lead);
    else onOpenLead(lead);
  };

  const openAISelector = () => {
    setAiSelect(true);
    setQuery('');
    setOpen(true);
  };

  return (
    <>
      <div className="global-quick-actions" aria-label="Ações rápidas">
        <button type="button" className="global-search-launcher" onClick={() => setOpen(true)} title="Buscar no Fuply (⌘K)"><Search size={18} /><span>Buscar</span><kbd>⌘K</kbd></button>
        <button type="button" className="global-ai-launcher" onClick={openAISelector} title="Responder cliente com IA"><Sparkles size={18} /><span>IA</span></button>
        <button type="button" className="global-add-lead" onClick={onNewLead} title="Novo lead"><Plus size={23} /></button>
      </div>

      {open && (
        <div className="command-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Busca global" onMouseDown={event => event.stopPropagation()}>
            <div className="command-search"><Search size={19} /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder={aiSelect ? 'Qual cliente respondeu?' : 'Buscar lead, empresa, telefone ou ação...'} /><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button></div>
            {!aiSelect ? (
              <div className="command-section">
                <span className="command-section-title">Ações</span>
                {commands.map(command => {
                  const Icon = command.icon;
                  return <button type="button" className="command-row" key={command.id} onClick={() => runCommand(command.id)}><Icon size={17} /><div><strong>{command.label}</strong><span>{command.hint}</span></div></button>;
                })}
              </div>
            ) : (
              <div className="command-intent-note"><Sparkles size={17} /><div><strong>Responder com IA</strong><span>Escolha o cliente que acabou de responder.</span></div><button type="button" onClick={() => setAiSelect(false)}>Voltar</button></div>
            )}
            <div className="command-section">
              <span className="command-section-title">{aiSelect ? 'Escolha o lead' : 'Leads'}</span>
              {matches.length ? matches.map(lead => <button type="button" className="command-row" key={lead.id} onClick={() => openLead(lead)}>{aiSelect ? <Sparkles size={17} /> : <MessageCircle size={17} />}<div><strong>{lead.name}</strong><span>{aiSelect ? 'Abrir Assistente de Vendas IA' : `${lead.company || lead.phone} · ${lead.status}`}</span></div></button>) : <div className="command-empty">Nenhum lead encontrado.</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
