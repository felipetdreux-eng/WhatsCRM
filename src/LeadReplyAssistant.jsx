import React, { useMemo, useState } from 'react';
import { Check, Copy, LoaderCircle, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from './supabaseClient';
import './lead-reply-assistant.css';

const replyLabels = {
  direct: 'Direta',
  consultative: 'Consultiva',
  persuasive: 'Persuasiva',
};

export default function LeadReplyAssistant({ lead, openWhatsApp }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [activeReply, setActiveReply] = useState('direct');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reply = useMemo(() => result?.replies?.[activeReply] || '', [result, activeReply]);

  const requestAnalysis = async () => {
    const customerMessage = message.trim();
    if (!customerMessage || !lead?.id) return null;

    const { data, error: invokeError } = await supabase.functions.invoke('sales-assistant', {
      body: {
        leadId: lead.id,
        customerMessage,
      },
    });

    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(data.error);
    if (!data?.replies?.direct) throw new Error('O assistente retornou uma resposta inválida.');
    return data;
  };

  const analyze = async event => {
    event?.preventDefault?.();
    if (!message.trim() || loading) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const data = await requestAnalysis();
      setResult(data);
      setActiveReply('direct');
    } catch (analysisError) {
      console.error('Sales assistant failed:', analysisError);
      setResult(null);
      setError('Não consegui analisar essa mensagem agora. Confirme sua sessão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const regenerate = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const data = await requestAnalysis();
      setResult(data);
      setActiveReply(current => current === 'direct' ? 'consultative' : current === 'consultative' ? 'persuasive' : 'direct');
    } catch (analysisError) {
      console.error('Sales assistant regenerate failed:', analysisError);
      setError('Não consegui gerar outra resposta agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const engineLabel = result?.source === 'openai'
    ? `IA ativa${result?.model ? ` · ${result.model}` : ''}`
    : result?.aiConfigured === false
      ? 'IA aguardando configuração'
      : result
        ? 'Fallback automático'
        : '';

  if (!open) {
    return (
      <section className="detail-card reply-assistant-collapsed">
        <div className="reply-assistant-intro">
          <div className="reply-assistant-icon"><Sparkles size={18} /></div>
          <div>
            <strong>Não sabe o que responder?</strong>
            <span>Cole a mensagem do cliente e o Fuply sugere como continuar a conversa.</span>
          </div>
        </div>
        <button type="button" className="reply-assistant-open" onClick={() => setOpen(true)}><Sparkles size={16} /> Me ajuda a responder</button>
      </section>
    );
  }

  return (
    <section className="detail-card reply-assistant-card">
      <div className="section-heading reply-assistant-heading">
        <div>
          <h2><Sparkles size={17} /> Me ajuda a responder</h2>
          <p>Cole exatamente o que o cliente falou.</p>
        </div>
        <button type="button" className="reply-assistant-close" onClick={() => { setOpen(false); setResult(null); setError(''); }}>Fechar</button>
      </div>

      <form className="reply-assistant-form" onSubmit={analyze}>
        <label>
          <span>Mensagem de {lead?.name || 'cliente'}</span>
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder="Ex.: Achei caro, vou pensar e falar com meu sócio."
            rows={4}
            disabled={loading}
          />
        </label>
        <div className="reply-assistant-form-footer">
          <small>A análise usa o contexto deste lead e nunca envia a mensagem sem sua aprovação.</small>
          <button type="submit" disabled={!message.trim() || loading}>
            {loading ? <LoaderCircle className="reply-assistant-spinner" size={15} /> : <Sparkles size={15} />}
            {loading ? 'Analisando...' : 'Analisar mensagem'}
          </button>
        </div>
        {error && <div className="reply-assistant-error" role="alert">{error}</div>}
      </form>

      {result && (
        <div className="reply-assistant-result">
          <div className={`reply-engine-badge ${result.source === 'openai' ? 'active' : 'fallback'}`}>
            <Sparkles size={12} /> {engineLabel}
          </div>
          <div className="reply-analysis-grid">
            <article><span>Objeção detectada</span><strong>{result.objection}</strong></article>
            <article><span>Intenção provável</span><strong>{result.intent}</strong></article>
            <article className="wide"><span>Estratégia</span><strong>{result.strategy}</strong></article>
            <article className="wide"><span>Próxima ação</span><strong>{result.nextAction}</strong></article>
          </div>

          <div className="reply-options-head">
            <div><strong>Resposta sugerida</strong><span>Escolha o tom que combina com a conversa.</span></div>
            <button type="button" disabled={loading} onClick={regenerate}>
              {loading ? <LoaderCircle className="reply-assistant-spinner" size={14} /> : <RefreshCw size={14} />} Gerar outra
            </button>
          </div>

          <div className="reply-tone-tabs" role="tablist" aria-label="Tom da resposta">
            {Object.entries(replyLabels).map(([key, label]) => (
              <button type="button" key={key} className={activeReply === key ? 'active' : ''} onClick={() => { setActiveReply(key); setCopied(false); }}>{label}</button>
            ))}
          </div>

          <div className="reply-message-box">{reply}</div>

          <div className="reply-actions">
            <button type="button" className="reply-copy" onClick={copyReply}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copiado' : 'Copiar'}</button>
            <button type="button" className="reply-whatsapp" onClick={() => openWhatsApp?.(lead, reply, { source: 'reply-assistant-ai' })}><MessageCircle size={15} /> Abrir no WhatsApp</button>
          </div>
        </div>
      )}
    </section>
  );
}
