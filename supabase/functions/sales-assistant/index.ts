import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.4-mini";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  value: number | null;
  status: string;
  origin: string | null;
  notes: string | null;
  next_contact: string | null;
  next_contact_time: string | null;
  next_action: string | null;
};

type Analysis = {
  objection: string;
  intent: string;
  strategy: string;
  nextAction: string;
  replies: {
    direct: string;
    consultative: string;
    persuasive: string;
  };
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    objection: { type: "string", minLength: 1, maxLength: 80 },
    intent: { type: "string", minLength: 1, maxLength: 220 },
    strategy: { type: "string", minLength: 1, maxLength: 260 },
    nextAction: { type: "string", minLength: 1, maxLength: 180 },
    replies: {
      type: "object",
      additionalProperties: false,
      properties: {
        direct: { type: "string", minLength: 1, maxLength: 500 },
        consultative: { type: "string", minLength: 1, maxLength: 700 },
        persuasive: { type: "string", minLength: 1, maxLength: 700 },
      },
      required: ["direct", "consultative", "persuasive"],
    },
  },
  required: ["objection", "intent", "strategy", "nextAction", "replies"],
} as const;

function fallbackAnalysis(message: string, lead: Lead): Analysis {
  const text = message.toLowerCase();
  const firstName = String(lead.name || "").trim().split(/\s+/)[0] || "cliente";

  if (/caro|pre[cç]o|valor|or[cç]amento|desconto/.test(text)) {
    return {
      objection: "Preço",
      intent: "Interessado, mas inseguro com o investimento",
      strategy: "Entender a faixa de orçamento antes de oferecer desconto.",
      nextAction: "Perguntar qual faixa de investimento o cliente imaginava.",
      replies: {
        direct: "Entendo. Qual faixa de investimento você tinha imaginado para esse projeto?",
        consultative: "Entendo a questão do valor. Antes de mexermos na proposta, posso entender qual faixa de investimento você tinha em mente? Assim vejo o que dá para ajustar sem comprometer o resultado.",
        persuasive: "Faz sentido olhar com cuidado para o investimento. Posso te mostrar onde está concentrado o valor da proposta e, a partir disso, ver se existe algum ajuste que faça sentido para você?",
      },
    };
  }

  if (/s[oó]cio|esposa|marido|pai|m[aã]e|conversar|pensar|decidir/.test(text)) {
    return {
      objection: "Decisão / aprovação",
      intent: "Tem interesse, mas depende de outra pessoa para avançar",
      strategy: "Facilitar a decisão e oferecer informação para a conversa interna.",
      nextAction: "Perguntar o que a outra pessoa precisa avaliar para decidir.",
      replies: {
        direct: "Perfeito. Tem algum ponto da proposta que eu possa deixar mais claro para facilitar essa conversa?",
        consultative: "Sem problema. Se ajudar, posso resumir os pontos principais da proposta para vocês avaliarem juntos e tirar qualquer dúvida antes da decisão.",
        persuasive: "Perfeito. Antes de vocês conversarem, posso te mandar um resumo bem direto dos principais benefícios e do que está incluso, para a decisão ficar mais fácil?",
      },
    };
  }

  if (/prazo|demora|entrega|quando|tempo|urgente/.test(text)) {
    return {
      objection: "Prazo",
      intent: "Interessado, mas preocupado com a entrega",
      strategy: "Entender a urgência real antes de prometer um prazo.",
      nextAction: "Perguntar qual é a data limite que o cliente precisa.",
      replies: {
        direct: "Entendi. Qual é a data limite que você precisa ter isso pronto?",
        consultative: "Entendo a preocupação com o prazo. Me fala qual seria a data ideal para você e eu vejo o cenário mais realista antes de te confirmar qualquer coisa.",
        persuasive: "Pra eu te responder com segurança e não prometer algo impossível, me diz qual é a sua data limite. Aí eu verifico a melhor forma de encaixar o projeto.",
      },
    };
  }

  if (/concorr|outra empresa|outra proposta|compar/.test(text)) {
    return {
      objection: "Concorrência",
      intent: "Está comparando opções antes de decidir",
      strategy: "Descobrir o critério de comparação sem atacar concorrentes.",
      nextAction: "Perguntar qual ponto está pesando mais na comparação.",
      replies: {
        direct: "Entendi. O que está pesando mais na sua comparação: valor, prazo ou o que está incluso?",
        consultative: "Faz sentido comparar antes de decidir. Qual ponto está fazendo mais diferença entre as propostas? Posso te explicar exatamente como a nossa está montada.",
        persuasive: "Comparar é importante. Se você me disser o que mais chamou sua atenção na outra proposta, eu consigo te mostrar onde estão as diferenças sem enrolação.",
      },
    };
  }

  return {
    objection: "Hesitação",
    intent: `A mensagem de ${firstName} ainda não mostra claramente o bloqueio principal`,
    strategy: "Fazer uma pergunta curta para descobrir o bloqueio real.",
    nextAction: "Perguntar o que falta para o cliente conseguir avançar.",
    replies: {
      direct: "Entendi. O que está faltando hoje para você conseguir avançar?",
      consultative: "Sem problema. Para eu não ficar te mandando informação à toa, qual é a principal dúvida ou ponto que você ainda precisa avaliar?",
      persuasive: "Entendi. Se você me disser qual é o principal ponto que ainda está te segurando, eu consigo te responder de forma bem objetiva.",
    },
  };
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type !== "message") continue;
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
}

async function analyzeWithAI(customerMessage: string, lead: Lead): Promise<Analysis> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");

  const context = {
    cliente: lead.name,
    empresaOuInteresse: lead.company || "Não informado",
    status: lead.status,
    valorPotencial: Number(lead.value || 0),
    origem: lead.origin || "Não informada",
    observacoes: String(lead.notes || "").slice(0, 2500) || "Sem observações",
    proximaAcao: lead.next_action || "Não definida",
    proximoContato: lead.next_contact || "Não definido",
    mensagemDoCliente: customerMessage,
  };

  const instructions = `Você é o assistente comercial do Fuply, um CRM para pequenas e médias empresas brasileiras.\n\nAnalise a mensagem do cliente junto com o contexto da negociação e ajude o vendedor a avançar a conversa de forma natural no WhatsApp.\n\nRegras:\n- Responda sempre em português do Brasil.\n- Não invente preços, prazos, descontos, condições, garantias ou informações que não estejam no contexto.\n- Não ofereça desconto automaticamente. Se houver objeção de preço, primeiro ajude a entender orçamento, valor percebido ou escopo.\n- Não seja agressivo, manipulador, insistente ou artificial.\n- As mensagens devem parecer escritas por uma pessoa real, não por um robô corporativo.\n- A resposta direta deve ser curta. A consultiva pode fazer uma pergunta para entender melhor. A persuasiva deve reforçar valor sem pressionar.\n- Se a mensagem já indicar intenção forte de compra, priorize facilitar o próximo passo em vez de continuar vendendo.\n- Se não houver informação suficiente, reconheça a incerteza e faça uma pergunta útil.\n- Não inclua aspas em volta das respostas prontas.\n- Entregue apenas os campos definidos no schema.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      reasoning: { effort: "none" },
      instructions,
      input: JSON.stringify(context),
      max_output_tokens: 1200,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "fuply_sales_reply_analysis",
          strict: true,
          schema: analysisSchema,
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI HTTP ${response.status}`;
    throw new Error(`OPENAI_ERROR: ${message}`);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error("OPENAI_EMPTY_RESPONSE");

  const parsed = JSON.parse(outputText) as Analysis;
  if (!parsed?.objection || !parsed?.replies?.direct || !parsed?.replies?.consultative || !parsed?.replies?.persuasive) {
    throw new Error("OPENAI_INVALID_RESPONSE");
  }
  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: jsonHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sessão não encontrada.");

    const body = await req.json();
    const leadId = String(body?.leadId || "").trim();
    const customerMessage = String(body?.customerMessage || "").trim();

    if (!leadId) return new Response(JSON.stringify({ error: "leadId é obrigatório." }), { status: 400, headers: jsonHeaders });
    if (!customerMessage) return new Response(JSON.stringify({ error: "A mensagem do cliente é obrigatória." }), { status: 400, headers: jsonHeaders });
    if (customerMessage.length > 5000) return new Response(JSON.stringify({ error: "Mensagem muito longa." }), { status: 400, headers: jsonHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: lead, error } = await supabase
      .from("leads")
      .select("id,name,company,phone,value,status,origin,notes,next_contact,next_contact_time,next_action")
      .eq("id", leadId)
      .single();

    if (error || !lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado ou sem acesso." }), { status: 404, headers: jsonHeaders });
    }

    let analysis: Analysis;
    let source = "openai";
    let aiConfigured = true;
    let model: string | null = OPENAI_MODEL;

    try {
      analysis = await analyzeWithAI(customerMessage, lead as Lead);
    } catch (aiError) {
      console.error("sales-assistant AI fallback:", aiError);
      analysis = fallbackAnalysis(customerMessage, lead as Lead);
      source = "rules-fallback";
      aiConfigured = Boolean(Deno.env.get("OPENAI_API_KEY"));
      model = null;
    }

    return new Response(JSON.stringify({
      ...analysis,
      source,
      aiConfigured,
      model,
      context: {
        leadId: lead.id,
        name: lead.name,
        company: lead.company,
        status: lead.status,
        value: Number(lead.value || 0),
        origin: lead.origin,
        nextAction: lead.next_action,
      },
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado." }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
