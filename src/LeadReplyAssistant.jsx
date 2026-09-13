import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, LoaderCircle, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from './supabaseClient';
import './lead-reply-assistant.css';

const SELLER_CONTEXT_KEY = 'fuply-sales-context';

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

const messageTypeLabels = {
  automatic_greeting: 'Provável saudação automática',
  customer_reply: 'Resposta do cliente',
  buying_signal: 'Sinal de compra',
  objection: 'Objeção',
  question: 'Pergunta do cliente',
  followup: 'Continuação de conversa',
  mixed: 'Conversa com vários sinais',
  unknown: 'Tipo incerto',
};

function readSellerContext() {
  try {
    return localStorage.getItem(SELLER_CONTEXT_KEY) || '';
  } catch {
    return '';
  }
}

export default function LeadReplyAssistant({ lead, openWhatsApp, openSignal = 0 }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('quick');
  const [message, setMessage] = useState('');
  const [sellerMessage, setSellerMessage] = useState('');
  const [sellerContext, setSellerContext] = useState(readSellerContext);
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
    setMessage('');
    setSellerMessage('');
    setExtraContext('');
  }, [lead?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(SELLER_CONTEXT_KEY, sellerContext);
    } catch {
      // Local storage can be unavailable in private/restricted browsing. The assistant still works.
    }
  }, [sellerContext]);

  const reply = useMemo(() => result?.replies?.[activeReply] || '', [result, activeReply]);
  const needsMoreContext = Boolean(result?.needsMoreContext);

  const requestAnalysis = async () => {
    const conversation = message.trim();
    if (!conversation || !lead?.id) return null;

    const { data, error: invokeError } = await supabase.functions.invoke('sales-assistant', {
      body: {
        leadId: lead.id,
        mode,
        conversation,
        sellerMessage: sellerMessage.trim(),
        sellerContext: sellerContext.trim(),
        extraContext: extraContext.trim(),
        goal,
      },
    });

    if (invokeError) {
      console.error('Sales assistant function error:', invokeError);
      throw new Error('A IA real não respondeu. O Fuply não vai inventar uma resposta no lugar dela.');
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.replies?.direct) throw new Error('A IA retornou uma resposta inválida.');
    if (data?.source !== 'openai') throw new Error('A resposta não veio da IA real. Tente novamente.');
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
      setError(analysisError instanceof Error ? analysisError.message : 'Não consegui analisar essa conversa agora.');
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    if (!reply || needsMoreContext) return;
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
      setError(analysisError instanceof Error ? analysisError.message : 'Não consegui gerar outra resposta agora.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = nextMode => {
    setMode(nextMode);
    setResult(null);
    setError('');
  };

  if (!open) {
    return (
      <section ref={sectionRef} id="reply-assistant" className="detail-card reply-assistant-collapsed">
        <div className="reply-assistant-intro">
          <div className="reply-assistant-icon"><Sparkles size={18} /></div>
          <div>
            <strong>Copiloto de Vendas IA</strong>
            <span>Entende o que você mandou, o que o cliente respondeu e o histórico do lead antes de sugerir qualquer resposta.</span>
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
          <p>O Fuply só sugere uma resposta quando entende contexto suficiente para não chutar.</p>
        </div>
        <button type="button" className="reply-assistant-close" onClick={() => { setOpen(false); setResult(null); setError(''); }}>Fechar</button>
      </div>

      <div className="reply-mode-switch" role="tablist" aria-label="Modo de análise">
        <button type="button" className={mode === 'quick' ? 'active' : ''} onClick={() => switchMode('quick')}>
          <strong>Resposta rápida</strong><span>Sua mensagem + resposta do cliente</span>
        </button>
        <button type="button" className={mode === 'full' ? 'active' : ''} onClick={() => switchMode('full')}>
          <strong>Conversa completa</strong><span>Todo o histórico do WhatsApp</span>
        </button>
      </div>

      <form className="reply-assistant-form" onSubmit={analyze}>
        <label className="reply-seller-context">
          <span>O que você vende? <b>fica salvo neste dispositivo</b></span>
          <textarea
            value={sellerContext}
            onChange={event => setSellerContext(event.target.value)}
            placeholder="Ex.: Vendo o Fuply, um CRM para pequenas empresas organizar leads, follow-ups e respostas comerciais com IA."
            rows={2}
            maxLength={1800}
            disabled={loading}
          />
          <small className="reply-field-hint">Esse contexto evita que a IA invente o que você está oferecendo.</small>
        </label>

        {mode === 'quick' ? (
          <div className="reply-quick-context">
            <label>
              <span>Sua última mensagem antes da resposta <b>opcional, mas recomendado</b></span>
              <textarea
                value={sellerMessage}
                onChange={event => setSellerMessage(event.target.value)}
                placeholder="Ex.: Oi! Vi que vocês trabalham com móveis planejados. Criamos uma ferramenta para organizar leads e follow-ups..."
                rows={4}
                maxLength={5000}
                disabled={loading}
              />
            </label>
            <label>
              <span>O que {lead?.name || 'o cliente'} respondeu</span>
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Ex.: Seja bem-vindo! Como podemos ajudar?"
                rows={4}
                maxLength={5000}
                disabled={loading}
              />
            </label>
          </div>
        ) : (
          <label>
            <span>Conversa completa com {lead?.name || 'o cliente'}</span>
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="Cole a conversa inteira aqui. Pode incluir nomes, horários e mensagens dos dois lados."
              rows={11}
              maxLength={12000}
              disabled={loading}
            />
            <small className="reply-field-hint">{message.length.toLocaleString('pt-BR')}/12.000 caracteres</small>
          </label>
        )}

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
              placeholder="Ex.: ainda não falei preço; ele é o dono; quero primeiro conseguir permissão para mostrar o produto."
              rows={3}
              maxLength={2500}
              disabled={loading}
            />
          </label>
        </div>

        <div className="reply-context-note">
          <Sparkles size={14} />
          <span>Além do que você cola aqui, a IA recebe os dados do lead, observações, próxima ação e o histórico recente registrado no Fuply.</span>
        </div>

        <div className="reply-assistant-form-footer">
          <small>Se faltar contexto, a IA deve pedir informação em vez de fabricar uma resposta.</small>
          <button type="submit" disabled={!message.trim() || loading}>
            {loading ? <LoaderCircle className="reply-assistant-spinner" size={15} /> : <Sparkles size={15} />}
            {loading ? 'Entendendo a conversa...' : 'Analisar conversa'}
          </button>
        </div>
        {error && <div className="reply-assistant-error reply-ai-hard-error" role="alert"><AlertTriangle size={15} /><span>{error}</span></div>}
      </form>

      {result && (
        <div className="reply-assistant-result">
          <div className="reply-result-meta">
            <div className="reply-engine-badge active"><Sparkles size={12} /> IA real · {result?.model || 'OpenAI'}</div>
            <span className="reply-confidence-badge">Confiança: {Math.max(0, Math.min(100, Number(result?.confidence || 0)))}%</span>
            {Number.isFinite(Number(result?.historyItemsUsed)) && (
              <span className="reply-history-badge">{result.historyItemsUsed} registros do Fuply considerados</span>
            )}
          </div>

          <div className="reply-message-type">
            <span>{messageTypeLabels[result?.messageType] || messageTypeLabels.unknown}</span>
            {result?.messageType === 'automatic_greeting' && <strong>Isso não conta como interesse comercial.</strong>}
          </div>

          <div className="reply-analysis-grid">
            <article className="wide spotlight"><span>Situação atual</span><strong>{result.situation || result.intent}</strong></article>
            <article className="wide"><span>O que já aconteceu</span><strong>{result.historySummary || 'A IA usou somente fatos encontrados no contexto disponível.'}</strong></article>
            <article><span>Objeção / bloqueio</span><strong>{result.objection}</strong></article>
            <article><span>Intenção provável</span><strong>{result.intent}</strong></article>
            <article className="wide"><span>Estratégia</span><strong>{result.strategy}</strong></article>
            <article className="wide"><span>Próxima ação</span><strong>{result.nextAction}</strong></article>
          </div>

          {needsMoreContext ? (
            <div className="reply-missing-context">
              <AlertTriangle size={18} />
              <div>
                <strong>Falta contexto para responder sem inventar.</strong>
                <span>{result.contextQuestion || 'Adicione mais contexto da conversa e analise novamente.'}</span>
                <small>O Fuply escondeu as respostas prontas de propósito. Melhor pedir contexto do que mandar merda para o cliente.</small>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </section>
  );
}
