import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...cors, "Content-Type": "application/json" };

const configuredModel = String(Deno.env.get("OPENAI_MODEL") || "").trim();
const MODELS = Array.from(new Set([configuredModel, "gpt-5.4-mini"].filter(Boolean)));
const STAGES = ["0_triagem", "1_amaciar", "2_permissao", "3_explicar", "4_mostrar", "5_negociar"] as const;
type Stage = typeof STAGES[number];

type Lead = {
  id: string;
  name: string;
  company: string | null;
  status: string;
  origin: string | null;
  notes: string | null;
  next_contact: string | null;
  next_action: string | null;
};

type Activity = {
  kind: string | null;
  title: string | null;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

function norm(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function looksAutomatic(value: string) {
  const text = norm(value);
  if (!text || text.length > 430) return false;
  return [
    /seja bem.?vindo/,
    /como podemos (te )?ajudar/,
    /em que podemos (te )?ajudar/,
    /agradecemos .*contato/,
    /obrigad[oa] por entrar em contato/,
    /horario de atendimento/,
    /retornaremos (assim que|em breve)/,
    /recebemos sua mensagem/,
    /digite [0-9]/,
    /escolha uma opcao/,
  ].some(pattern => pattern.test(text));
}

function stageFor(value: string): Stage {
  const text = norm(value);
  if (looksAutomatic(value)) return "0_triagem";
  if (/\b(mostra|mostrar|quero ver|manda a demo|mande a demo|demo|demonstracao|na pratica)\b/.test(text)) return "4_mostrar";
  if (/\b(o que e|qual (e o )?produto|do que se trata|como funciona|marketing digital|e marketing)\b/.test(text)) return "3_explicar";
  if (/^(pode( sim)?|manda|pode mandar|fala|pode falar|me conta|pode explicar|sim pode)[.! ]*$/.test(text)) return "2_permissao";
  if (/\b(preco|valor|quanto custa|desconto|contrato|assinar|fechar)\b/.test(text)) return "5_negociar";
  return "1_amaciar";
}

function nicheContext(lead: Lead) {
  const text = norm(`${lead.company || ""} ${lead.notes || ""}`);
  if (/(planejad|marcen|moveis)/.test(text)) return { area: "orçamentos e projetos", object: "orçamento", plural: "orçamentos" };
  if (/(engenharia|reforma|arquitet|construcao)/.test(text)) return { area: "orçamentos e propostas", object: "proposta", plural: "propostas e orçamentos" };
  if (/(solar|energia)/.test(text)) return { area: "comercial e propostas", object: "proposta", plural: "propostas" };
  return { area: "comercial e orçamentos", object: "oportunidade", plural: "oportunidades" };
}

function compactActivities(rows: Activity[]) {
  return rows.slice().reverse().map(item => ({
    data: item.created_at,
    tipo: item.kind,
    titulo: String(item.title || "").slice(0, 180),
    detalhe: String(item.detail || "").slice(0, 700),
    mensagemPreparada: typeof item.metadata?.preparedMessage === "string"
      ? String(item.metadata.preparedMessage).slice(0, 1600)
      : undefined,
  }));
}

const FUPLY_KNOWLEDGE = `
FUPLY — BASE OFICIAL COMPLETA DO PRODUTO

POSICIONAMENTO
- Fuply é um CRM comercial para pequenas e médias empresas organizarem leads, oportunidades, pipeline, negociações e follow-ups.
- A proposta central é evitar que uma oportunidade esfrie ou seja esquecida por falta de organização e retorno.
- O Fuply não é agência de marketing digital, não compra anúncios e não promete gerar demanda sozinho. Ele atua principalmente depois que já existe um lead/oportunidade.

1. INÍCIO / CENTRAL DO DIA
- Mostra prioridades comerciais do dia.
- Destaca leads que precisam de atenção.
- Reúne follow-ups vencidos, de hoje e próximos contatos.
- Ajuda o vendedor a saber por onde começar sem revisar a base inteira.

2. PIPELINE
- Organiza cada lead por etapa comercial.
- Etapas principais: Novo lead, Contatado, Interessado, Proposta enviada, Negociação, Fechado e Perdido.
- Permite visualizar rapidamente onde cada oportunidade está no funil.
- É útil para acompanhar vendas que levam dias ou semanas e exigem vários retornos.

3. LEADS
- Cadastro de nome, empresa/interesse, WhatsApp, valor potencial, origem, status, responsável, próxima ação, próximo contato e observações.
- Busca e filtros para localizar oportunidades.
- Modos de visualização simples e completo.
- Edição rápida de informações comerciais importantes.
- Importação de bases para trazer vários contatos de uma vez.

4. FOLLOW-UPS / PRÓXIMA AÇÃO
- Cada lead pode ter próxima ação e data de próximo contato.
- O sistema usa essas informações para lembrar o vendedor de retornar na hora certa.
- A função existe para impedir que proposta/orçamento desapareça no meio de outros contatos.

5. LEADS INTELIGENTES
- O Fuply prioriza oportunidades considerando estágio, origem, valor potencial, recência e timing do follow-up.
- Gera uma pontuação/prioridade para ajudar a decidir quem merece atenção primeiro.
- Pode sugerir ações como atacar agora, prioridade alta, média ou baixa.
- Não trate essa pontuação como garantia de venda; é priorização operacional.

6. RESULTADOS
- Dá visão do andamento comercial e do funil.
- Ajuda a enxergar quantas oportunidades estão avançando, fechando ou sendo perdidas.
- Serve para acompanhar desempenho do processo comercial, não para inventar ROI.

7. AUTOPILOT
- Camada mais avançada de recomendação e priorização.
- Ajuda a sugerir próximos passos e organizar o que merece atenção.
- Não diga que ele envia mensagens sozinho ou executa ações irreversíveis sem aprovação.

8. COPILOTO DE VENDAS IA
- Analisa a última resposta ou uma conversa completa.
- Pode usar dados do lead, observações, próxima ação e histórico recente do Fuply.
- Identifica situação, objeção, intenção provável e melhor próximo passo.
- Gera respostas em tons Direto, Consultivo e Persuasivo.
- Possui fluxo obrigatório de etapas: triagem, amaciar, permissão, explicar, mostrar e negociar.
- Detecta mensagens que parecem saudação automática/institucional sem afirmar com certeza que é robô.
- Não deve inventar preço, prazo, desconto ou funcionalidade.

9. HISTÓRICO DO LEAD
- Registra atividades comerciais relevantes.
- Uma mensagem preparada pelo Fuply pode ser registrada como contexto.
- Abrir o WhatsApp não prova que a mensagem foi enviada, entregue ou lida.
- Use histórico para compreender continuidade da negociação, sem transformar registro operacional em fato que não aconteceu.

10. WHATSAPP
- O Fuply pode preparar uma mensagem e abrir o WhatsApp para o vendedor revisar/enviar.
- A aprovação humana continua importante.
- Não diga que o Fuply lê automaticamente todas as conversas do WhatsApp.
- Não diga que uma mensagem foi enviada só porque o WhatsApp foi aberto.

11. DETECÇÃO DE DUPLICADOS
- Identifica possíveis leads repetidos usando sinais como WhatsApp, nome e empresa.
- Ajuda a evitar uma base comercial bagunçada.
- Não diga que o sistema apaga ou mescla automaticamente sem confirmação se isso não estiver explícito.

12. EQUIPES / WORKSPACES
- Permite organizar leads dentro de um espaço de trabalho/equipe.
- Leads podem ter responsável.
- Isso ajuda a distribuir acompanhamento comercial e manter contexto compartilhado.

13. AÇÕES RÁPIDAS E BUSCA
- Há busca global e atalhos para navegar e encontrar leads/ações com mais rapidez.
- O vendedor pode acessar funções importantes sem ficar caçando telas.

14. CAPTAÇÃO POR SITE
- Quando uma integração de site/formulário está configurada, um novo pedido pode entrar como lead no Fuply automaticamente.
- O lead pode chegar com origem Site, interesse/serviço, orçamento estimado e observações.
- Não prometa que qualquer site já está integrado sem verificar.

15. VALOR POTENCIAL / ORIGEM / CONTEXTO
- O CRM guarda valor potencial e origem para ajudar a priorizar e analisar oportunidades.
- Esses dados são apoio para decisão, não previsão garantida de receita.

16. PERDIDOS E MOTIVOS
- O processo pode registrar oportunidades perdidas e motivo da perda.
- Exemplos de motivo: preço, sem resposta, concorrente, sem orçamento agora, prazo, falta de interesse real ou outro.
- Isso ajuda a entender onde o processo comercial está falhando.

LIMITES QUE NUNCA DEVEM SER INVENTADOS
- preço atual;
- desconto;
- duração de teste grátis;
- prazo de implantação;
- SLA;
- integrações ainda não confirmadas;
- automação total de WhatsApp;
- leitura automática de conversas pessoais;
- envio automático confirmado;
- pagamentos ou funcionalidades futuras.
Se o cliente perguntar algo que não está nesta base ou no contexto do vendedor, não invente.

CLIENTE IDEAL
- Pequenas e médias empresas com vários leads/orçamentos/propostas e necessidade de acompanhar o cliente por dias ou semanas.
- Especialmente vendas consultivas e tickets mais altos, em que esquecer um retorno pode custar uma oportunidade relevante.
- Nichos comuns: móveis planejados, marcenaria, reformas, engenharia, energia solar, arquitetura, construção, vidraçaria e serviços B2B.
`;

const MESSAGING_PLAYBOOK = `
PROCEDIMENTO OFICIAL DE MENSAGENS DO FUPLY
Regra principal: COZINHAR A CARNE. Cada mensagem vende somente o próximo pequeno passo.

MENSAGEM OFICIAL DE INTRODUÇÃO DO FUPLY — USAR DEPOIS QUE A PESSOA DER ABERTURA/PERMISSÃO
Estrutura canônica:
"Percebemos que, em operações como a de vocês, um [orçamento/proposta/oportunidade] pode passar por vários retornos até fechar. Foi justamente por isso que criamos o Fuply: ele organiza os leads, mostra em que etapa cada oportunidade está e deixa claro quem precisa de retorno, para nenhuma negociação esfriar ou seja esquecida. Posso te mostrar rapidinho como funciona na prática?"

REGRAS DA INTRODUÇÃO
- Adapte orçamento/proposta/oportunidade ao nicho.
- Pode usar o nome da empresa quando estiver confirmado.
- Não diga "percebemos que vocês perdem clientes" ou outra acusação sem evidência.
- Não liste todas as funcionalidades nessa primeira introdução.
- Não fale preço espontaneamente.
- O objetivo da introdução é conseguir autorização para MOSTRAR.
- Preserve a ideia central: problema típico do processo -> por que criamos o Fuply -> benefício central -> convite simples para mostrar.

ETAPA 0 — TRIAGEM / POSSÍVEL AUTOMAÇÃO
- Para mensagens como "seja bem-vindo", "como podemos ajudar?", menu, horário ou confirmação de recebimento.
- Não afirmar que é robô nem humano.
- Não explicar o Fuply ainda.
- Objetivo: chegar a quem cuida do comercial/orçamentos.
- Exemplo: "Oi! Tudo bem? Queria falar rapidinho com quem cuida dos orçamentos/comercial aí. É por aqui mesmo?"

ETAPA 1 — AMACIAR
- Há uma pessoa respondendo, mas ainda não houve permissão clara para apresentação.
- Faça uma mensagem curta e ligada ao processo do nicho.
- Não use catálogo de funcionalidades e não fale preço.
- Exemplo: "Em empresas de planejados, orçamento costuma precisar de alguns retornos até fechar. A gente criou uma ideia justamente para organizar esse acompanhamento. Posso te explicar rapidinho?"

ETAPA 2 — PERMISSÃO RECEBIDA
- Sinais: "pode", "pode sim", "manda", "fala", "me conta", "pode explicar".
- Isso é permissão para continuar, não intenção forte de compra.
- Use a MENSAGEM OFICIAL DE INTRODUÇÃO DO FUPLY acima, adaptada ao nicho.
- Termine conduzindo para mostrar na prática.

ETAPA 3 — EXPLICAR O QUE É
- Sinais: "o que é?", "qual produto?", "do que se trata?", "como funciona?", "é marketing?".
- Agora explique diretamente: Fuply é um CRM comercial para organizar leads, pipeline e follow-ups, com IA ajudando na priorização e nas respostas.
- Cite no máximo 2 ou 3 funções relevantes para aquele prospecto.
- Se perguntarem se é marketing digital, diga claramente que não. O Fuply entra no acompanhamento comercial das oportunidades.

ETAPA 4 — MOSTRAR
- Sinais: "mostra", "quero ver", "manda a demo", "pode mostrar", "como fica na prática?".
- A pessoa já autorizou. Não peça permissão novamente.
- Demonstração padrão deve priorizar: Pipeline -> Central do Dia/follow-ups -> Copiloto de IA.
- Explique usando um exemplo do nicho: oportunidade entra, recebe etapa, aparece quando precisa de retorno e a IA ajuda a continuar a conversa.
- Não fale preço espontaneamente.

ETAPA 5 — NEGOCIAR
- Só depois de interesse real, dúvida, objeção ou pergunta direta de preço.
- Se perguntarem preço e ele não estiver no contexto, peça ao vendedor a condição correta.
- Nunca invente.

ESTILO DE MENSAGEM
- Português do Brasil natural de WhatsApp.
- Curto ou médio, normalmente 1 a 4 parágrafos curtos.
- Uma ideia principal e um CTA.
- Sem jargão corporativo vazio.
- Evite começar com "Perfeito!", "Ótimo!" ou "Que bom!" sem uma razão real.
- Não usar pressão, urgência falsa ou manipulação.
- Não despejar 15 funcionalidades só porque você conhece todas.
- Conhecer todas as funções serve para escolher as MAIS RELEVANTES para o contexto.

REGRA DE TRANSIÇÃO
- Nunca pule de triagem direto para pitch completo.
- Nunca trate "pode sim" como compra.
- Nunca trate saudação automática como interesse.
- Nunca pergunte "posso mostrar?" se a pessoa já pediu para mostrar.
- Avance somente uma etapa por mensagem.
`;

function safeReply(stage: Stage, lead: Lead, message: string) {
  const niche = nicheContext(lead);
  const company = lead.company || lead.name || "a empresa";
  const common = {
    source: "safe-procedure",
    model: null,
    stage,
    confidence: 96,
    needsMoreContext: false,
    contextQuestion: "",
    objection: "Nenhuma objeção clara",
    historyItemsUsed: 0,
  };

  if (stage === "0_triagem") {
    return {
      ...common,
      messageType: "automatic_greeting",
      situation: "Provável saudação automática ou institucional; não há evidência suficiente para saber se uma pessoa respondeu.",
      historySummary: "A resposta é genérica e não comprova interesse comercial.",
      intent: "Não é possível inferir intenção humana.",
      strategy: "Fazer triagem antes de apresentar o Fuply.",
      nextAction: `Confirmar o contato de quem cuida de ${niche.area}.`,
      replies: {
        direct: `Oi! Tudo bem? Queria falar rapidinho com quem cuida de ${niche.area} aí. É por aqui mesmo?`,
        consultative: `Oi! Tudo bem? Queria falar com quem acompanha ${niche.area} aí na ${company}. É por aqui mesmo ou tem outra pessoa que cuida disso?`,
        persuasive: `Oi! Tudo bem? Tenho uma ideia ligada ao acompanhamento de ${niche.area}, mas queria falar com a pessoa certa antes de explicar. É por aqui mesmo?`,
      },
    };
  }

  if (stage === "1_amaciar") {
    return {
      ...common,
      messageType: "customer_reply",
      situation: "Primeiro contato humano ainda sem permissão clara para apresentação.",
      historySummary: "Ainda não houve pedido explícito para explicar ou mostrar o produto.",
      intent: "Abertura ainda em avaliação.",
      strategy: "Criar relevância e ganhar permissão.",
      nextAction: "Enviar uma mensagem curta ligada ao processo comercial do nicho.",
      replies: {
        direct: `Em empresas como a de vocês, ${niche.plural} costumam precisar de alguns retornos até fechar. A gente criou uma forma de organizar esse acompanhamento. Posso te explicar rapidinho?`,
        consultative: `Em operações como a de vocês, ${niche.plural} costumam exigir alguns retornos até fechar. Como vocês organizam esse acompanhamento hoje?`,
        persuasive: `Em negócios como o de vocês, perder o timing de um retorno pode deixar uma boa oportunidade esfriar. A gente criou uma forma simples de organizar isso. Posso te mostrar a ideia em poucas linhas?`,
      },
    };
  }

  if (stage === "2_permissao") {
    return {
      ...common,
      messageType: "customer_reply",
      situation: "O prospecto deu permissão para continuar, mas isso ainda não é intenção forte de compra.",
      historySummary: `A resposta “${String(message).slice(0, 100)}” autoriza continuar a apresentação.`,
      intent: "Permitiu continuar a apresentação.",
      strategy: "Usar a introdução oficial do Fuply e conduzir para demonstração.",
      nextAction: "Apresentar problema típico + benefício central + convite para mostrar.",
      replies: {
        direct: `Percebemos que, em operações como a de vocês, um ${niche.object} pode passar por vários retornos até fechar. Foi justamente por isso que criamos o Fuply: ele organiza os leads, mostra em que etapa cada oportunidade está e deixa claro quem precisa de retorno, para nenhuma negociação esfriar ou ser esquecida. Posso te mostrar rapidinho como funciona na prática?`,
        consultative: `Em operações como a de vocês, ${niche.plural} podem passar por vários retornos até fechar. O Fuply organiza cada oportunidade, a etapa em que ela está e o próximo contato. A ideia é evitar que uma negociação boa esfrie por falta de acompanhamento. Posso te mostrar um exemplo aplicado à operação de vocês?`,
        persuasive: `Foi justamente pensando em operações com vários ${niche.plural} e retornos que criamos o Fuply. Ele deixa cada oportunidade organizada, mostra quem precisa de atenção e ajuda a manter o acompanhamento até o fechamento. Posso te mostrar isso funcionando na prática?`,
      },
    };
  }

  if (stage === "3_explicar") {
    return {
      ...common,
      messageType: "question",
      situation: "O prospecto pediu uma explicação sobre o produto.",
      historySummary: "Agora faz sentido explicar o Fuply de forma curta e relevante.",
      intent: "Quer entender o produto antes de decidir se continua.",
      strategy: "Definir o produto e citar somente funções relevantes ao contexto.",
      nextAction: "Explicar e conduzir para demonstração.",
      replies: {
        direct: `O Fuply é um CRM comercial para organizar leads, pipeline e follow-ups em um só lugar. Ele mostra quais oportunidades precisam de retorno e também tem um Copiloto de IA para ajudar nas respostas. Para uma operação como a de vocês, a ideia é acompanhar cada ${niche.object} até o fechamento sem deixar retorno passar.`,
        consultative: `O Fuply organiza leads, etapas e follow-ups em um só lugar e usa IA para ajudar nas respostas. Para eu te mostrar a parte mais útil, hoje vocês acompanham ${niche.plural} mais por WhatsApp, planilha ou algum CRM?`,
        persuasive: `O Fuply centraliza cada oportunidade, mostra quem precisa de retorno e usa IA para ajudar quando o cliente responde. O objetivo é deixar cada ${niche.object} com etapa e próximo passo claros, sem depender da memória do vendedor.`,
      },
    };
  }

  if (stage === "4_mostrar") {
    return {
      ...common,
      messageType: "buying_signal",
      situation: "O prospecto pediu para ver o produto.",
      historySummary: "Já existe autorização para demonstração; não é necessário pedir permissão novamente.",
      intent: "Quer visualizar o Fuply na prática.",
      strategy: "Ir direto à demonstração e focar nas três provas de valor.",
      nextAction: "Mostrar Pipeline, Central do Dia/follow-ups e Copiloto de IA.",
      replies: {
        direct: `Claro. Na prática eu te mostraria três partes: o Pipeline, onde cada oportunidade fica na etapa certa; a Central do Dia, que mostra quem precisa de retorno; e o Copiloto de IA, que ajuda a responder usando o contexto da negociação.`,
        consultative: `Claro. O fluxo é simples: um ${niche.object} entra no Pipeline, aparece quando precisa de retorno e, quando o cliente responde, o Copiloto ajuda a continuar a conversa. A demo fica bem fácil de entender usando um exemplo parecido com o processo de vocês.`,
        persuasive: `Claro. Na demo o mais importante é ver o fluxo inteiro: oportunidade entra, recebe uma etapa, aparece na hora certa do follow-up e a IA ajuda na resposta. Assim dá para entender o valor sem ficar olhando um monte de tela solta.`,
      },
    };
  }

  const askingPrice = /\b(preco|valor|quanto custa)\b/.test(norm(message));
  return {
    ...common,
    messageType: askingPrice ? "question" : "followup",
    situation: "A conversa chegou à negociação.",
    historySummary: "Há avanço comercial, mas o sistema não deve inventar condição.",
    intent: askingPrice ? "Quer saber o investimento." : "Há interesse a conduzir.",
    strategy: askingPrice ? "Pedir a condição correta ao vendedor." : "Responder ao ponto específico e facilitar o próximo passo.",
    nextAction: askingPrice ? "Informar ao Copiloto o preço atual." : "Avançar usando apenas fatos confirmados.",
    needsMoreContext: askingPrice,
    contextQuestion: askingPrice ? "Qual preço/condição comercial devemos informar para este prospecto?" : "",
    replies: {
      direct: askingPrice ? "Contexto insuficiente para informar preço com segurança." : "Entendi. O melhor é alinhar esse ponto e seguir daí, sem complicar a conversa.",
      consultative: askingPrice ? "Contexto insuficiente para informar preço com segurança." : "Entendi. Qual é o principal ponto que você quer validar antes de avançarmos?",
      persuasive: askingPrice ? "Contexto insuficiente para informar preço com segurança." : "Faz sentido. Vamos resolver esse ponto primeiro e, se estiver alinhado, seguimos para o próximo passo.",
    },
  };
}

function parseJSON(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

async function askAI(model: string, instructions: string, input: unknown) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      instructions,
      input: JSON.stringify(input),
      max_output_tokens: 1900,
      text: { verbosity: "low" },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${payload?.error?.message || "OpenAI error"}`);

  let raw = typeof payload?.output_text === "string" ? payload.output_text : "";
  if (!raw) {
    for (const item of Array.isArray(payload?.output) ? payload.output : []) {
      for (const part of Array.isArray(item?.content) ? item.content : []) {
        if (part?.type === "output_text" && typeof part?.text === "string") raw = part.text;
      }
    }
  }
  if (!raw) throw new Error("EMPTY_OUTPUT");
  return parseJSON(raw);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Sessão não encontrada." }), { status: 401, headers });

    const body = await req.json();
    const leadId = String(body?.leadId || "").trim();
    const mode = body?.mode === "full" ? "full" : "quick";
    const offerMode = body?.offerMode === "custom" ? "custom" : "fuply";
    const conversation = String(body?.conversation || body?.customerMessage || "").trim();
    const sellerMessage = String(body?.sellerMessage || "").trim();
    const sellerContext = String(body?.sellerContext || "").trim();
    const extra = String(body?.extraContext || "").trim();

    if (!leadId || !conversation) {
      return new Response(JSON.stringify({ error: "Lead e conversa são obrigatórios." }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id,name,company,status,origin,notes,next_contact,next_action")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado ou sem acesso." }), { status: 404, headers });
    }

    const { data: activities } = await supabase
      .from("lead_activities")
      .select("kind,title,detail,metadata,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20);

    const currentLead = lead as Lead;
    const activityRows = (activities || []) as Activity[];
    const tail = mode === "full" ? conversation.slice(-1800) : conversation;
    const stage = stageFor(tail);
    const sellingFuply = offerMode === "fuply" || norm(`${sellerContext} ${sellerMessage} ${extra}`).includes("fuply");

    const input = {
      stageObrigatoria: stage,
      possivelAutomacao: looksAutomatic(tail),
      modo: mode,
      oferta: sellingFuply ? "Fuply" : "Outro",
      mensagemAnteriorDoVendedor: mode === "quick" ? (sellerMessage || "não informada") : "na conversa",
      respostaDoProspecto: mode === "quick" ? conversation : "na conversa",
      conversaCompleta: mode === "full" ? conversation : "não fornecida",
      contextoExtra: extra || "nenhum",
      contextoOutroProduto: sellingFuply ? "use a base oficial" : sellerContext,
      lead: {
        nome: currentLead.name,
        empresa: currentLead.company,
        status: currentLead.status,
        origem: currentLead.origin,
        notas: String(currentLead.notes || "").slice(0, 3000),
        proximaAcao: currentLead.next_action,
      },
      historico: compactActivities(activityRows),
    };

    const prompt = `Você é o Copiloto de Vendas do Fuply.\n\n${sellingFuply ? FUPLY_KNOWLEDGE : "Não use fatos do Fuply para descrever outro produto; use somente o contexto fornecido."}\n\n${MESSAGING_PLAYBOOK}\n\nREGRAS DE EXECUÇÃO\n- Conhecer todas as funcionalidades NÃO significa citar todas. Escolha somente as mais relevantes à etapa e ao nicho.\n- A stageObrigatoria é uma trava. No modo rápido siga essa etapa; em dúvida não avance.\n- Se possivelAutomacao=true, não afirme robô nem humano e faça triagem.\n- Se a pessoa disse apenas “pode”, use a introdução oficial e conduza para mostrar.\n- Se pediu para mostrar, pare de pedir permissão e mostre.\n- Não invente preço, prazo, desconto, integração, promessa, resultado ou funcionalidade.\n- Eventos de WhatsApp aberto não provam envio, leitura ou resposta.\n- Português natural de WhatsApp. Uma ideia principal e um CTA.\n\nRetorne SOMENTE JSON válido com: situation, historySummary, messageType, stage, confidence (0-100), needsMoreContext, contextQuestion, objection, intent, strategy, nextAction, replies {direct, consultative, persuasive}. stage deve ser uma destas: ${STAGES.join(", ")}.`;

    let output: any = null;
    let modelUsed = "";
    const errors: string[] = [];

    if (Deno.env.get("OPENAI_API_KEY")) {
      for (const model of MODELS) {
        try {
          output = await askAI(model, prompt, input);
          modelUsed = model;
          break;
        } catch (error) {
          errors.push(`${model}: ${error instanceof Error ? error.message : "erro"}`);
        }
      }
    } else {
      errors.push("OPENAI_API_KEY_NOT_CONFIGURED");
    }

    if (output) {
      const result = {
        situation: String(output.situation || "Contexto analisado."),
        historySummary: String(output.historySummary || ""),
        messageType: looksAutomatic(tail) ? "automatic_greeting" : String(output.messageType || "unknown"),
        stage: looksAutomatic(tail) ? "0_triagem" : stage,
        confidence: Math.max(0, Math.min(100, Number(output.confidence) || 80)),
        needsMoreContext: Boolean(output.needsMoreContext),
        contextQuestion: String(output.contextQuestion || ""),
        objection: String(output.objection || "Nenhuma objeção clara"),
        intent: String(output.intent || ""),
        strategy: String(output.strategy || ""),
        nextAction: String(output.nextAction || ""),
        replies: {
          direct: String(output?.replies?.direct || ""),
          consultative: String(output?.replies?.consultative || output?.replies?.direct || ""),
          persuasive: String(output?.replies?.persuasive || output?.replies?.direct || ""),
        },
        source: "openai",
        model: modelUsed,
        historyItemsUsed: activityRows.length,
        stageHint: stage,
        productKnowledgeVersion: 3,
      };

      if (result.replies.direct) {
        return new Response(JSON.stringify(result), { status: 200, headers });
      }
    }

    const fallback = safeReply(stage, currentLead, conversation);
    return new Response(JSON.stringify({
      ...fallback,
      historyItemsUsed: activityRows.length,
      stageHint: stage,
      aiConfigured: Boolean(Deno.env.get("OPENAI_API_KEY")),
      aiErrorSummary: errors.slice(0, 4).map(item => item.slice(0, 240)),
      productKnowledgeVersion: 3,
    }), { status: 200, headers });
  } catch (error) {
    console.error("sales-copilot fatal", error);
    return new Response(JSON.stringify({ error: "Erro inesperado no Copiloto." }), { status: 500, headers });
  }
});