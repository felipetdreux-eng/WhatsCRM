import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function analyzeMessage(message: string, lead: Lead): Analysis {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sessão não encontrada.");

    const body = await req.json();
    const leadId = String(body?.leadId || "").trim();
    const customerMessage = String(body?.customerMessage || "").trim();

    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!customerMessage) {
      return new Response(JSON.stringify({ error: "A mensagem do cliente é obrigatória." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (customerMessage.length > 5000) {
      return new Response(JSON.stringify({ error: "Mensagem muito longa." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "Lead não encontrado ou sem acesso." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = analyzeMessage(customerMessage, lead as Lead);
    return new Response(JSON.stringify({
      ...analysis,
      source: "edge-v1",
      context: {
        leadId: lead.id,
        name: lead.name,
        company: lead.company,
        status: lead.status,
        value: Number(lead.value || 0),
        origin: lead.origin,
        nextAction: lead.next_action,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
