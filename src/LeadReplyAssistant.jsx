import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from './supabaseClient';
import './lead-reply-assistant.css';

const replyLabels = {
  direct: 'Direta',
  consultative: 'Consultiva',
  persuasive: 'Persuasiva',
};

const goals = [
  ['auto', 'Deixar a IA decidir'],
  ['demo', 'Marcar demonstração'],
  ['budget', 'Descobrir orçamento'],
  ['recover', 'Recuperar cliente frio'],
  ['close', 'Avançar para fechamento'],
  ['objection', 'Responder objeção'],
];

export default function LeadReplyAssistant({ lead, openWhatsApp, openSignal = 0 }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('quick');
  const [message, setMessage] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [goal, setGoal] = useState('auto');
  const [result, setResult] = useState(null);
  const [activeReply, setActiveReply] = useState('direct');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sectionRef = useRef(null);

  useEffect(() => {
    if (!openSignal) return;
    setOpen(true);
    window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }, [openSignal]);

  useEffect(() => {
    setResult(null);
    setError('');
  }, [lead?.id]);

  const reply = useMemo(() => result?.replies?.[activeReply] || '', [result, activeReply]);

  const requestAnalysis = async () => {
    const conversation = message.trim();
    if (!conversation || !lead?.id) return null;

    const { data, error: invokeError } = await supabase.functions.invoke('sales-assistant', {
      body: {
        leadId: lead.id,
        mode,
        conversation,
        extraContext: extraContext.trim(),
        goal,
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
      setError('Não consegui analisar essa conversa agora. Confirme sua sessão e tente novamente.');
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

  const switchMode = nextMode => {
    setMode(nextMode);
    setResult(null);
    setError('');
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
      <section ref={sectionRef} id="reply-assistant" className="detail-card reply-assistant-collapsed">
        <div className="reply-assistant-intro">
          <div className="reply-assistant-icon"><Sparkles size={18} /></div>
          <div>
            <strong>Assistente de Vendas IA</strong>
            <span>Cole uma mensagem ou a conversa inteira. A IA usa o contexto e o histórico do lead para montar a próxima resposta.</span>
          </div>
        </div>
        <button type="button" className="reply-assistant-open" onClick={() => setOpen(true)}><Sparkles size={16} /> Responder com IA</button>
      </section>
    );
  }

  return (
    <section ref={sectionRef} id="reply-assistant" className="detail-card reply-assistant-card">
      <div className="section-heading reply-assistant-heading">
        <div>
          <h2><Sparkles size={17} /> Copiloto de Vendas IA</h2>
          <p>Quanto mais contexto você passar, menos a IA precisa adivinhar.</p>
        </div>
        <button type="button" className="reply-assistant-close" onClick={() => { setOpen(false); setResult(null); setError(''); }}>Fechar</button>
      </div>

      <div className="reply-mode-switch" role="tablist" aria-label="Modo de análise">
        <button type="button" className={mode === 'quick' ? 'active' : ''} onClick={() => switchMode('quick')}>
          <strong>Resposta rápida</strong><span>Só a última mensagem</span>
        </button>
        <button type="button" className={mode === 'full' ? 'active' : ''} onClick={() => switchMode('full')}>
          <strong>Conversa completa</strong><span>Todo o histórico do WhatsApp</span>
        </button>
      </div>

      <form className="reply-assistant-form" onSubmit={analyze}>
        <label>
          <span>{mode === 'full' ? `Conversa com ${lead?.name || 'cliente'}` : `Última mensagem de ${lead?.name || 'cliente'}`}</span>
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder={mode === 'full'
              ? 'Cole a conversa inteira aqui. Pode incluir nomes, horários e mensagens dos dois lados.'
              : 'Ex.: Gostei, mas achei o valor alto. Vou conversar com meu sócio.'}
            rows={mode === 'full' ? 10 : 4}
            maxLength={12000}
            disabled={loading}
          />
          <small className="reply-field-hint">{message.length.toLocaleString('pt-BR')}/12.000 caracteres</small>
        </label>

        <div className="reply-context-grid">
          <label>
            <span>O que você quer conseguir?</span>
            <select value={goal} onChange={event => setGoal(event.target.value)} disabled={loading}>
              {goals.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Contexto extra <b>opcional</b></span>
            <textarea
              className="reply-extra-context"
              value={extraContext}
              onChange={event => setExtraContext(event.target.value)}
              placeholder="Ex.: ainda não falei preço; já mostrei a demo; ele é o dono; não quero pressionar."
              rows={3}
              maxLength={2500}
              disabled={loading}
            />
          </label>
        </div>

        <div className="reply-context-note">
          <Sparkles size={14} />
          <span>O Fuply também envia para a IA os dados do lead, observações, próxima ação e o histórico recente registrado no CRM.</span>
        </div>

        <div className="reply-assistant-form-footer">
          <small>Nada é enviado ao cliente sem sua aprovação.</small>
          <button type="submit" disabled={!message.trim() || loading}>
            {loading ? <LoaderCircle className="reply-assistant-spinner" size={15} /> : <Sparkles size={15} />}
            {loading ? 'Entendendo a conversa...' : 'Analisar conversa'}
          </button>
        </div>
        {error && <div className="reply-assistant-error" role="alert">{error}</div>}
      </form>

      {result && (
        <div className="reply-assistant-result">
          <div className="reply-result-meta">
            <div className={`reply-engine-badge ${result.source === 'openai' ? 'active' : 'fallback'}`}>
              <Sparkles size={12} /> {engineLabel}
            </div>
            {Number.isFinite(Number(result?.historyItemsUsed)) && (
              <span className="reply-history-badge">{result.historyItemsUsed} registros do Fuply considerados</span>
            )}
          </div>

          <div className="reply-analysis-grid">
            <article className="wide spotlight"><span>Situação atual</span><strong>{result.situation || result.intent}</strong></article>
            <article className="wide"><span>O que já aconteceu</span><strong>{result.historySummary || 'A IA usou o contexto disponível da negociação.'}</strong></article>
            <article><span>Objeção / bloqueio</span><strong>{result.objection}</strong></article>
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
