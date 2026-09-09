import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, Pencil, Plus, Search, Send, X } from 'lucide-react';
import './messages.css';

const DEFAULT_TEMPLATES = [
  {
    id: 'first-contact',
    title: 'Primeiro contato',
    category: 'Prospecção',
    text: 'Oi, {nome}! Tudo bem? Vi seu trabalho e queria te apresentar uma solução que pode ajudar a organizar seus contatos e oportunidades pelo WhatsApp. Posso te explicar rapidinho?',
  },
  {
    id: 'follow-up',
    title: 'Follow-up',
    category: 'Retorno',
    text: 'Oi, {nome}! Passando para retomar nossa conversa. Você conseguiu ver o que combinamos? Se quiser, posso tirar qualquer dúvida por aqui.',
  },
  {
    id: 'proposal',
    title: 'Proposta',
    category: 'Negociação',
    text: 'Oi, {nome}! Preparei a proposta que conversamos. O valor ficou em {valor}. Se estiver tudo certo, posso te explicar os próximos passos por aqui.',
  },
  {
    id: 'last-attempt',
    title: 'Última tentativa',
    category: 'Retorno',
    text: 'Oi, {nome}! Só passando uma última vez para saber se ainda faz sentido continuarmos essa conversa. Se não for o momento, sem problema. Fico à disposição quando precisar.',
  },
];

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value || 0);

function personalize(text, lead) {
  if (!lead) return text;
  return text
    .replaceAll('{nome}', lead.name || 'cliente')
    .replaceAll('{empresa}', lead.company || '')
    .replaceAll('{valor}', currency(lead.value));
}

export default function Messages({ leads, openWhatsApp }) {
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('zapflow-messages'));
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    localStorage.setItem('zapflow-messages', JSON.stringify(templates));
  }, [templates]);

  const selectedLead = leads.find(lead => lead.id === selectedLeadId) || null;

  const filtered = useMemo(() => templates.filter(template => {
    const haystack = `${template.title} ${template.category} ${template.text}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [templates, query]);

  const copyTemplate = async template => {
    const text = personalize(template.text, selectedLead);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(template.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      // Clipboard can be blocked by the browser; the message remains visible/editable.
    }
  };

  const saveEdit = event => {
    event.preventDefault();
    if (!editing?.title?.trim() || !editing?.text?.trim()) return;
    setTemplates(current => current.map(item => item.id === editing.id ? editing : item));
    setEditing(null);
  };

  const resetTemplates = () => {
    setTemplates(DEFAULT_TEMPLATES);
    setEditing(null);
  };

  return (
    <main className="main-content messages-page">
      <header className="messages-header">
        <div>
          <span className="messages-kicker"><MessageCircle size={14} /> Biblioteca de mensagens</span>
          <h1>Mensagens</h1>
          <p>Use modelos prontos, personalize para o lead e abra a conversa no WhatsApp.</p>
        </div>
        <button className="secondary-button messages-reset" onClick={resetTemplates}>Restaurar modelos</button>
      </header>

      <section className="messages-controls">
        <label className="messages-search">
          <Search size={17} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar mensagem" aria-label="Buscar mensagens" />
        </label>
        <label className="messages-lead-picker">
          <span>Personalizar para</span>
          <select value={selectedLeadId} onChange={event => setSelectedLeadId(event.target.value)}>
            <option value="">Nenhum lead selecionado</option>
            {leads.filter(lead => !['Vendido', 'Perdido'].includes(lead.status)).map(lead => (
              <option key={lead.id} value={lead.id}>{lead.name} · {lead.status}</option>
            ))}
          </select>
        </label>
      </section>

      <div className="messages-hint">
        Use <code>{'{nome}'}</code>, <code>{'{empresa}'}</code> e <code>{'{valor}'}</code> para preencher automaticamente com os dados do lead.
      </div>

      <section className="messages-grid">
        {filtered.map(template => {
          const preview = personalize(template.text, selectedLead);
          return (
            <article className="message-card" key={template.id}>
              <div className="message-card-top">
                <div>
                  <span className="message-category">{template.category}</span>
                  <h2>{template.title}</h2>
                </div>
                <button className="message-icon-button" onClick={() => setEditing({ ...template })} aria-label={`Editar ${template.title}`}>
                  <Pencil size={16} />
                </button>
              </div>

              <div className="message-preview">{preview}</div>

              <div className="message-actions">
                <button className="message-copy" onClick={() => copyTemplate(template)}>
                  {copiedId === template.id ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
                </button>
                <button
                  className="message-send"
                  disabled={!selectedLead}
                  onClick={() => selectedLead && openWhatsApp(selectedLead, preview)}
                  title={selectedLead ? 'Abrir WhatsApp com a mensagem' : 'Selecione um lead primeiro'}
                >
                  <Send size={16} /> WhatsApp
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {filtered.length === 0 && (
        <section className="messages-empty">
          <MessageCircle size={28} />
          <h2>Nenhuma mensagem encontrada</h2>
          <p>Tente outro termo de busca.</p>
        </section>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <section className="modal message-edit-modal" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><h2>Editar mensagem</h2><p>O modelo fica salvo neste navegador.</p></div>
              <button className="icon-button" onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <form className="message-edit-form" onSubmit={saveEdit}>
              <label><span>Título</span><input value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} /></label>
              <label><span>Categoria</span><input value={editing.category} onChange={event => setEditing({ ...editing, category: event.target.value })} /></label>
              <label><span>Mensagem</span><textarea value={editing.text} onChange={event => setEditing({ ...editing, text: event.target.value })} rows={7} /></label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancelar</button>
                <button className="primary-button"><Check size={16} /> Salvar mensagem</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
