import React, { useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, RefreshCw, Send, Sparkles } from 'lucide-react';
import './lead-reply-assistant.css';

const MOCKS = {
  price: {
    objection: 'Preço',
    intent: 'Interessado, mas inseguro com o investimento',
    strategy: 'Entender a faixa de orçamento antes de oferecer desconto.',
    nextAction: 'Perguntar qual faixa de investimento o cliente imaginava.',
    replies: {
      direct: 'Entendo. Qual faixa de investimento você tinha imaginado para esse projeto?',
      consultative: 'Entendo a questão do valor. Antes de mexermos na proposta, posso entender qual faixa de investimento você tinha em mente? Assim vejo o que dá para ajustar sem comprometer o resultado.',
      persuasive: 'Faz sentido olhar com cuidado para o investimento. Posso te mostrar onde está concentrado o valor da proposta e, a partir disso, ver se existe algum ajuste que faça sentido para você?',
    },
  },
  decision: {
    objection: 'Decisão / aprovação',
    intent: 'Tem interesse, mas depende de outra pessoa para avançar',
    strategy: 'Facilitar a decisão e oferecer informação para a conversa interna.',
    nextAction: 'Perguntar o que a outra pessoa precisa avaliar para decidir.',
    replies: {
      direct: 'Perfeito. Tem algum ponto da proposta que eu possa deixar mais claro para facilitar essa conversa?',
      consultative: 'Sem problema. Se ajudar, posso resumir os pontos principais da proposta para vocês avaliarem juntos e tirar qualquer dúvida antes da decisão.',
      persuasive: 'Perfeito. Antes de vocês conversarem, posso te mandar um resumo bem direto dos principais benefícios e do que está incluso, para a decisão ficar mais fácil?',
    },
  },
  deadline: {
    objection: 'Prazo',
    intent: 'Interessado, mas preocupado com a entrega',
    strategy: 'Entender a urgência real antes de prometer um prazo.',
    nextAction: 'Perguntar qual é a data limite que o cliente precisa.',
    replies: {
      direct: 'Entendi. Qual é a data limite que você precisa ter isso pronto?',
      consultative: 'Entendo a preocupação com o prazo. Me fala qual seria a data ideal para você e eu vejo o cenário mais realista antes de te confirmar qualquer coisa.',
      persuasive: 'Pra eu te responder com segurança e não prometer algo impossível, me diz qual é a sua data limite. Aí eu verifico a melhor forma de encaixar o projeto.',
    },
  },
  competitor: {
    objection: 'Concorrência',
    intent: 'Está comparando opções antes de decidir',
    strategy: 'Descobrir o critério de comparação sem atacar concorrentes.',
    nextAction: 'Perguntar qual ponto está pesando mais na comparação.',
    replies: {
      direct: 'Entendi. O que está pesando mais na sua comparação: valor, prazo ou o que está incluso?',
      consultative: 'Faz sentido comparar antes de decidir. Qual ponto está fazendo mais diferença entre as propostas? Posso te explicar exatamente como a nossa está montada.',
      persuasive: 'Comparar é importante. Se você me disser o que mais chamou sua atenção na outra proposta, eu consigo te mostrar onde estão as diferenças sem enrolação.',
    },
  },
  generic: {
    objection: 'Hesitação',
    intent: 'Ainda não deu informação suficiente para identificar a objeção',
    strategy: 'Fazer uma pergunta curta para descobrir o bloqueio real.',
    nextAction: 'Perguntar o que falta para o cliente conseguir avançar.',
    replies: {
      direct: 'Entendi. O que está faltando hoje para você conseguir avançar?',
      consultative: 'Sem problema. Para eu não ficar te mandando informação à toa, qual é a principal dúvida ou ponto que você ainda precisa avaliar?',
      persuasive: 'Entendi. Se você me disser qual é o principal ponto que ainda está te segurando, eu consigo te responder de forma bem objetiva.',
    },
  },
};

function detectMock(message) {
  const text = String(message || '').toLowerCase();
  if (/caro|pre[cç]o|valor|or[cç]amento|desconto/.test(text)) return MOCKS.price;
  if (/s[oó]cio|esposa|marido|pai|m[aã]e|conversar|pensar|decidir/.test(text)) return MOCKS.decision;
  if (/prazo|demora|entrega|quando|tempo|urgente/.test(text)) return MOCKS.deadline;
  if (/concorr|outra empresa|outra proposta|compar/.test(text)) return MOCKS.competitor;
  return MOCKS.generic;
}

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

  const reply = useMemo(() => result?.replies?.[activeReply] || '', [result, activeReply]);

  const analyze = event => {
    event?.preventDefault?.();
    if (!message.trim()) return;
    setResult(detectMock(message));
    setActiveReply('direct');
    setCopied(false);
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

  const regenerate = () => {
    if (!message.trim()) return;
    setResult(detectMock(message));
    setActiveReply(current => current === 'direct' ? 'consultative' : current === 'consultative' ? 'persuasive' : 'direct');
    setCopied(false);
  };

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
        <button type="button" className="reply-assistant-close" onClick={() => { setOpen(false); setResult(null); }}>Fechar</button>
      </div>

      <form className="reply-assistant-form" onSubmit={analyze}>
        <label>
          <span>Mensagem de {lead?.name || 'cliente'}</span>
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder="Ex.: Achei caro, vou pensar e falar com meu sócio."
            rows={4}
          />
        </label>
        <div className="reply-assistant-form-footer">
          <small>Protótipo V1: análise local simulada, ainda sem IA conectada.</small>
          <button type="submit" disabled={!message.trim()}><Sparkles size={15} /> Analisar mensagem</button>
        </div>
      </form>

      {result && (
        <div className="reply-assistant-result">
          <div className="reply-analysis-grid">
            <article><span>Objeção detectada</span><strong>{result.objection}</strong></article>
            <article><span>Intenção provável</span><strong>{result.intent}</strong></article>
            <article className="wide"><span>Estratégia</span><strong>{result.strategy}</strong></article>
            <article className="wide"><span>Próxima ação</span><strong>{result.nextAction}</strong></article>
          </div>

          <div className="reply-options-head">
            <div><strong>Resposta sugerida</strong><span>Escolha o tom que combina com a conversa.</span></div>
            <button type="button" onClick={regenerate}><RefreshCw size={14} /> Gerar outra</button>
          </div>

          <div className="reply-tone-tabs" role="tablist" aria-label="Tom da resposta">
            {Object.entries(replyLabels).map(([key, label]) => (
              <button type="button" key={key} className={activeReply === key ? 'active' : ''} onClick={() => { setActiveReply(key); setCopied(false); }}>{label}</button>
            ))}
          </div>

          <div className="reply-message-box">{reply}</div>

          <div className="reply-actions">
            <button type="button" className="reply-copy" onClick={copyReply}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copiado' : 'Copiar'}</button>
            <button type="button" className="reply-whatsapp" onClick={() => openWhatsApp?.(lead, reply, { source: 'reply-assistant-v1' })}><MessageCircle size={15} /> Abrir no WhatsApp</button>
          </div>
        </div>
      )}
    </section>
  );
}
