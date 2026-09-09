import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, Pencil, Search, Send, X } from 'lucide-react';
import { loadLeads, loadMessages, syncMessages } from './backendBridge';
import './messages.css';

const LEGACY_FIRST_CONTACT = 'Oi, {nome}! Tudo bem? Vi seu trabalho e queria te apresentar uma solução que pode ajudar a organizar seus contatos e oportunidades pelo WhatsApp. Posso te explicar rapidinho?';

const DEFAULT_TEMPLATES = [
  {
    id: 'first-contact',
    title: 'Primeiro contato',
    category: 'Prospecção',
    text: 'Oi, {nome}! Tudo bem? Vi seu trabalho e queria conversar sobre uma possível parceria. Trabalho com serviços que podem ajudar no seu objetivo e posso te explicar rapidinho por aqui.',
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
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value));

const leadValue = lead => {
  if (!lead) return 0;
  const raw = lead.status === 'Vendido' ? (lead.saleValue ?? lead.value) : lead.value;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const personalize = (text, lead) => {
  if (!lead) return text;
  const value = leadValue(lead);
  return text
    .replaceAll('{nome}', lead.name || 'cliente')
    .replaceAll('{empresa}', lead.company || 'sua empresa')
    .replaceAll('{valor}', value > 0 ? currency(value) : 'valor a definir');
};

function mergeRemoteTemplates(remote) {
  const normalized = (Array.isArray(remote) ? remote : []).map(template => {
    if (template.id === 'first-contact' && template.text === LEGACY_FIRST_CONTACT) {
      return { ...template, text: DEFAULT_TEMPLATES[0].text };
    }
    return template;
  });

  const byId = new Map(normalized.map(template => [template.id, template]));
  const defaults = DEFAULT_TEMPLATES.map(template => byId.get(template.id) || template);
  const extras = normalized.filter(template => !DEFAULT_TEMPLATES.some(item => item.id === template.id));
  return [...defaults, ...extras];
}

export default function Messages({ leads = [], openWhatsApp, userId }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [leadOptions, setLeadOptions] = useState(Array.isArray(leads) ? leads : []);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      if (!userId) {
        if (active) {
          setError('Não foi possível identificar sua conta. Entre novamente.');
          setLoading(false);
        }
        return;
      }

      try {
        const [remoteTemplates, remoteLeads] = await Promise.all([
          loadMessages(userId),
          loadLeads(userId),
        ]);
        const merged = mergeRemoteTemplates(remoteTemplates);
        const missingDefaults = DEFAULT_TEMPLATES.some(template => !remoteTemplates.some(item => item.id === template.id));
        const migratedLegacy = remoteTemplates.some(template => template.id === 'first-contact' && template.text === LEGACY_FIRST_CONTACT);

        if (missingDefaults || migratedLegacy || remoteTemplates.length === 0) {
          await syncMessages(merged, userId);
        }

        if (active) {
          setTemplates(merged);
          if (remoteLeads.length || !leadOptions.length) setLeadOptions(remoteLeads);
        }
      } catch (loadError) {
        console.error('ZapFlow message load failed:', loadError);
        if (active) setError('Não foi possível carregar suas mensagens agora.');
      } finally {
        if (active) setLoading(false);
      }
    };

    hydrate();
    return () => { active = false; };
  }, [userId]);

  const selectedLead = leadOptions.find(lead => lead.id === selectedLeadId) || null;
  const filtered = useMemo(() => templates.filter(template => (
    `${template.title} ${template.category} ${template.text}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [templates, query]);

  const templateNeedsValue = template => template.text.includes('{valor}');
  const selectedLeadHasValue = leadValue(selectedLead) > 0;

  const copyTemplate = async template => {
    const invalidValue = selectedLead && templateNeedsValue(template) && !selectedLeadHasValue;
    if (invalidValue) {
      setError('Informe um valor potencial maior que zero no lead antes de usar uma proposta.');
      return;
    }

    try {
      await navigator.clipboard.writeText(personalize(template.text, selectedLead));
      setError('');
      setCopiedId(template.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      setError('Não foi possível copiar a mensagem.');
    }
  };

  const saveEdit = async event => {
    event.preventDefault();
    if (!editing?.title?.trim() || !editing?.text?.trim() || !userId) return;

    const next = {
      ...editing,
      title: editing.title.trim(),
      category: editing.category.trim(),
      text: editing.text.trim(),
    };

    setSaving(true);
    setError('');
    try {
      await syncMessages([next], userId);
      setTemplates(current => current.map(item => item.id === next.id ? next : item));
      setEditing(null);
    } catch (saveError) {
      console.error('ZapFlow message save failed:', saveError);
      setError('Não foi possível salvar essa mensagem no Supabase.');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setError('');
    try {
      await syncMessages(DEFAULT_TEMPLATES, userId);
      setTemplates(DEFAULT_TEMPLATES);
      setEditing(null);
    } catch (restoreError) {
      console.error('ZapFlow message restore failed:', restoreError);
      setError('Não foi possível restaurar os modelos agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content messages-page">
      <header className="messages-header">
        <div>
          <span className="messages-kicker"><MessageCircle size={14} /> Biblioteca de mensagens</span>
          <h1>Mensagens</h1>
          <p>Use modelos prontos, personalize para o lead e abra a conversa no WhatsApp.</p>
        </div>
        <button className="secondary-button messages-reset" onClick={restoreDefaults} disabled={saving || loading}>
          {saving ? 'Salvando...' : 'Restaurar modelos'}
        </button>
      </header>

      {error && <div className="messages-error" role="alert">{error}</div>}

      <section className="messages-controls">
        <label className="messages-search">
          <Search size={17} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar mensagem" aria-label="Buscar mensagens" />
        </label>
        <label className="messages-lead-picker">
          <span>Personalizar para</span>
          <select value={selectedLeadId} onChange={event => { setSelectedLeadId(event.target.value); setError(''); }}>
            <option value="">Nenhum lead selecionado</option>
            {leadOptions.filter(lead => !['Vendido', 'Perdido'].includes(lead.status)).map(lead => (
              <option key={lead.id} value={lead.id}>{lead.name} · {lead.status}</option>
            ))}
          </select>
        </label>
      </section>

      <div className="messages-hint">
        Use <code>{'{nome}'}</code>, <code>{'{empresa}'}</code> e <code>{'{valor}'}</code> para preencher automaticamente com os dados do lead. Modelos são salvos na sua conta.
      </div>

      {loading ? (
        <section className="messages-empty"><MessageCircle size={28} /><h2>Carregando mensagens...</h2></section>
      ) : (
        <section className="messages-grid">
          {filtered.map(template => {
            const preview = personalize(template.text, selectedLead);
            const missingValue = Boolean(selectedLead && templateNeedsValue(template) && !selectedLeadHasValue);
            return (
              <article className="message-card" key={template.id}>
                <div className="message-card-top">
                  <div><span className="message-category">{template.category}</span><h2>{template.title}</h2></div>
                  <button className="message-icon-button" onClick={() => { setEditing({ ...template }); setError(''); }} aria-label={`Editar ${template.title}`}><Pencil size={16} /></button>
                </div>
                <div className="message-preview">{preview}</div>
                {missingValue && <div className="message-value-warning">Adicione um valor potencial ao lead para enviar esta proposta.</div>}
                <div className="message-actions">
                  <button className="message-copy" onClick={() => copyTemplate(template)} disabled={missingValue}>
                    {copiedId === template.id ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
                  </button>
                  <button
                    className="message-send"
                    disabled={!selectedLead || missingValue}
                    onClick={() => selectedLead && !missingValue && openWhatsApp(selectedLead, preview)}
                    title={!selectedLead ? 'Selecione um lead primeiro' : missingValue ? 'Informe o valor potencial do lead' : 'Abrir WhatsApp com a mensagem'}
                  >
                    <Send size={16} /> WhatsApp
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!loading && !filtered.length && (
        <section className="messages-empty"><MessageCircle size={28} /><h2>Nenhuma mensagem encontrada</h2><p>Tente outro termo de busca.</p></section>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setEditing(null)}>
          <section className="modal message-edit-modal" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><h2>Editar mensagem</h2><p>O modelo fica salvo na sua conta do ZapFlow.</p></div>
              <button className="icon-button" onClick={() => setEditing(null)} disabled={saving}><X size={20} /></button>
            </div>
            <form className="message-edit-form" onSubmit={saveEdit}>
              <label><span>Título</span><input value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} /></label>
              <label><span>Categoria</span><input value={editing.category} onChange={event => setEditing({ ...editing, category: event.target.value })} /></label>
              <label><span>Mensagem</span><textarea value={editing.text} onChange={event => setEditing({ ...editing, text: event.target.value })} rows={7} /></label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                <button className="primary-button" disabled={saving}><Check size={16} /> {saving ? 'Salvando...' : 'Salvar mensagem'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
