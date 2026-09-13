import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const CONFIGURED_MODEL = String(Deno.env.get("OPENAI_MODEL") || "").trim();
const MODELS = Array.from(new Set([CONFIGURED_MODEL, "gpt-5.4-mini"].filter(Boolean)));

const GOALS: Record<string,string> = {
  auto: "Escolher o próximo pequeno avanço correto",
  demo: "Levar o prospecto para uma demonstração quando a etapa permitir",
  budget: "Entender orçamento quando a etapa permitir",
  recover: "Reaquecer cliente frio sem pressionar",
  close: "Avançar para fechamento somente quando houver sinal real",
  objection: "Responder a objeção sem pular etapas",
};

const MESSAGE_TYPES = ["automatic_greeting","customer_reply","buying_signal","objection","question","followup","mixed","unknown"] as const;
const STAGES = ["0_triagem","1_amaciar","2_permissao","3_explicar","4_mostrar","5_negociar"] as const;

type Stage = typeof STAGES[number];
type Lead = { id:string; name:string; company:string|null; value:number|null; status:string; origin:string|null; notes:string|null; next_contact:string|null; next_action:string|null };
type Activity = { kind:string|null; title:string|null; detail:string|null; metadata:Record<string,unknown>|null; created_at:string|null };
type Analysis = {
  situation:string; historySummary:string; messageType:typeof MESSAGE_TYPES[number]; stage:Stage; confidence:number;
  needsMoreContext:boolean; contextQuestion:string; objection:string; intent:string; strategy:string; nextAction:string;
  replies:{direct:string;consultative:string;persuasive:string};
};

const schema = {
  type:"object", additionalProperties:false,
  properties:{
    situation:{type:"string",minLength:1,maxLength:380},
    historySummary:{type:"string",minLength:1,maxLength:650},
    messageType:{type:"string",enum:MESSAGE_TYPES},
    stage:{type:"string",enum:STAGES},
    confidence:{type:"integer",minimum:0,maximum:100},
    needsMoreContext:{type:"boolean"}, contextQuestion:{type:"string",minLength:0,maxLength:320},
    objection:{type:"string",minLength:1,maxLength:140}, intent:{type:"string",minLength:1,maxLength:300},
    strategy:{type:"string",minLength:1,maxLength:420}, nextAction:{type:"string",minLength:1,maxLength:280},
    replies:{ type:"object", additionalProperties:false, properties:{
      direct:{type:"string",minLength:1,maxLength:750}, consultative:{type:"string",minLength:1,maxLength:950}, persuasive:{type:"string",minLength:1,maxLength:950}
    }, required:["direct","consultative","persuasive"] }
  },
  required:["situation","historySummary","messageType","stage","confidence","needsMoreContext","contextQuestion","objection","intent","strategy","nextAction","replies"]
} as const;

const FUPLY = `
FUPLY — FONTE DE VERDADE
Fuply é um CRM comercial para pequenas e médias empresas organizarem leads, pipeline, negociações e follow-ups.
Ele ajuda a evitar oportunidades esquecidas, mostra quem precisa de atenção, organiza próxima ação/contato, prioriza leads e possui Copiloto de Vendas IA.
Funcionalidades reais relevantes para demonstração: Pipeline; Início/Central do Dia e follow-ups; Leads Inteligentes; Copiloto de IA; cadastro/importação de leads; histórico de atividades; equipes; detecção de duplicados; abertura do WhatsApp com mensagem preparada; site/formulário pode enviar leads ao Fuply quando integrado.
Fuply NÃO é marketing digital, não compra anúncios e não promete gerar demanda sozinho. Ele atua principalmente depois que existe uma oportunidade comercial.
Não invente automação total de WhatsApp, leitura automática de conversas, envio confirmado, preço, desconto, teste grátis, prazo, integrações ou funcionalidades futuras.
Cliente ideal: empresa com vários orçamentos/leads e venda que exige retorno por dias ou semanas. Nichos frequentes: móveis planejados/marcenaria, reformas, engenharia, energia solar, arquitetura, construção e serviços B2B.
`;

const PROCEDURE = `
PROCEDIMENTO OBRIGATÓRIO DE MENSAGENS DO FUPLY
Regra máxima: COZINHAR A CARNE. Cada mensagem vende apenas o próximo pequeno passo. Não despeje o produto cedo.

ETAPA 0 — TRIAGEM / POSSÍVEL AUTOMAÇÃO
Use quando vier "seja bem-vindo", "como podemos ajudar?", horário, menu, agradecimento de contato ou mensagem institucional/genérica.
Você NÃO sabe se foi robô ou humano. Diga internamente que é provável automação/institucional, mas identidade incerta.
Não explique Fuply. Não liste funções. Não fale preço. Não trate como interesse.
Objetivo: chegar a quem cuida de comercial/orçamentos ou confirmar que é o canal certo.
Exemplo bom: "Oi! Tudo bem? Queria falar rapidinho com quem cuida dos orçamentos/comercial aí. É por aqui mesmo?"
Adapte vocabulário ao nicho.

ETAPA 1 — AMACIAR
Use quando há uma pessoa respondendo, mas ela ainda não pediu detalhes nem deu permissão clara.
Mensagem curta. Crie relevância pelo processo do nicho, sem afirmar que a empresa tem um problema específico.
Não faça pitch, não liste funções, não fale preço.
Objetivo: ganhar permissão para continuar.
Exemplo mental para planejados: "Em empresas de planejados, orçamento costuma precisar de vários retornos até fechar. Posso te mostrar uma ideia que criamos para organizar isso?"

ETAPA 2 — PERMISSÃO RECEBIDA
Sinais: "pode", "pode sim", "manda", "fala", "me conta", "pode explicar".
Isso é permissão, NÃO intenção forte de compra.
Agora explique dor + benefício em poucas linhas. Fale que criamos o Fuply para organizar leads/orçamentos/follow-ups e evitar oportunidade esquecida.
Não liste 15 funções. Não fale preço. Termine pedindo para mostrar na prática.

ETAPA 3 — EXPLICAR O QUE É
Sinais: "o que é?", "qual produto?", "do que se trata?", "é marketing?", "como funciona?".
Agora explique curto: Fuply é um CRM comercial para organizar leads, pipeline e follow-ups, com IA ajudando prioridades e respostas.
Conecte ao nicho. Se perguntarem se é marketing digital, diga que não e explique a diferença.
Conduza para demonstração.

ETAPA 4 — MOSTRAR
Sinais: "mostra", "quero ver", "manda a demo", "pode mostrar", "como fica na prática?".
A pessoa já autorizou. NÃO peça "posso mostrar?" de novo.
Mostre/encaminhe a demonstração. Explique rapidamente o que verá: Pipeline, Central do Dia/follow-ups e Copiloto de IA.
Use exemplo do nicho: orçamento entra, muda de etapa, aparece quando precisa de retorno e a IA ajuda a responder.
Não invente link. Não fale preço espontaneamente.

ETAPA 5 — NEGOCIAR
Só depois de interesse real, dúvidas, objeção ou pergunta direta de preço.
Se perguntarem preço e ele não estiver no contexto, needsMoreContext=true. Não invente.
Se houver objeção, trate a objeção. Se já quer comprar, facilite o próximo passo e pare de vender benefício.

REGRAS DE TRANSIÇÃO
Nunca pule 0→3/4. Nunca trate "pode sim" como compra. Nunca trate saudação automática como interesse.
Nunca volte a pedir permissão para mostrar se já pediram para mostrar.
Avance apenas UMA etapa por resposta. Se houver dúvida entre etapas, escolha a anterior/conservadora.
`;

function norm(v:string){ return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim(); }
function looksAuto(v:string){ const t=norm(v); if(!t||t.length>380) return false; return [/seja bem.?vindo/,/como podemos (te )?ajudar/,/em que podemos (te )?ajudar/,/agradecemos .*contato/,/obrigad[oa] por entrar em contato/,/horario de atendimento/,/retornaremos em breve/,/recebemos sua mensagem/,/digite [0-9]/,/escolha uma opcao/].some(r=>r.test(t)); }
function detectStageQuick(v:string):Stage{
  const t=norm(v);
  if(looksAuto(v)) return "0_triagem";
  if(/\b(mostra|mostrar|quero ver|manda a demo|mande a demo|demo|demonstracao|na pratica)\b/.test(t)) return "4_mostrar";
  if(/\b(o que e|qual (e o )?produto|do que se trata|como funciona|marketing digital|e marketing)\b/.test(t)) return "3_explicar";
  if(/^(pode( sim)?|manda|pode mandar|fala|pode falar|me conta|pode explicar|sim pode)[.! ]*$/.test(t)) return "2_permissao";
  if(/\b(preco|valor|quanto custa|desconto|contrato|assinar|fechar)\b/.test(t)) return "5_negociar";
  return "1_amaciar";
}
function compact(a:Activity[]){ return a.slice().reverse().map(x=>({data:x.created_at,tipo:x.kind,titulo:String(x.title||"").slice(0,180),detalhe:String(x.detail||"").slice(0,700),mensagemPreparada:typeof x.metadata?.preparedMessage==="string"?String(x.metadata.preparedMessage).slice(0,1600):undefined})); }
function outputText(p:any){ if(typeof p?.output_text==="string"&&p.output_text.trim()) return p.output_text.trim(); for(const i of Array.isArray(p?.output)?p.output:[]) for(const c of Array.isArray(i?.content)?i.content:[]) if(c?.type==="output_text"&&typeof c.text==="string") return c.text.trim(); return ""; }

async function ask(model:string,instructions:string,context:unknown){
  const key=Deno.env.get("OPENAI_API_KEY"); if(!key) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,store:false,reasoning:{effort:"low"},instructions,input:JSON.stringify(context),max_output_tokens:2200,text:{verbosity:"low",format:{type:"json_schema",name:"fuply_sales_copilot_v2",strict:true,schema}}})});
  const p=await r.json().catch(()=>({})); if(!r.ok) throw new Error(p?.error?.message||`OpenAI ${r.status}`);
  const raw=outputText(p); if(!raw) throw new Error("OPENAI_EMPTY");
  const x=JSON.parse(raw) as Analysis;
  if(!x?.situation||!x?.historySummary||!STAGES.includes(x.stage)||!MESSAGE_TYPES.includes(x.messageType)||!x?.replies?.direct) throw new Error("OPENAI_INVALID");
  x.confidence=Math.max(0,Math.min(100,Math.round(Number(x.confidence)||0))); return x;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return new Response(JSON.stringify({error:"Método não permitido."}),{status:405,headers:jsonHeaders});
  try{
    const auth=req.headers.get("Authorization"); if(!auth) return new Response(JSON.stringify({error:"Sessão não encontrada."}),{status:401,headers:jsonHeaders});
    const body=await req.json();
    const leadId=String(body?.leadId||"").trim(); const mode=body?.mode==="full"?"full":"quick"; const offerMode=body?.offerMode==="custom"?"custom":"fuply";
    const conversation=String(body?.conversation||body?.customerMessage||"").trim(); const sellerMessage=String(body?.sellerMessage||"").trim(); const sellerContext=String(body?.sellerContext||"").trim(); const extra=String(body?.extraContext||"").trim();
    const goal=Object.prototype.hasOwnProperty.call(GOALS,body?.goal)?String(body.goal):"auto";
    if(!leadId||!conversation) return new Response(JSON.stringify({error:"Lead e conversa são obrigatórios."}),{status:400,headers:jsonHeaders});
    if(conversation.length>12000||sellerMessage.length>5000||sellerContext.length>1800||extra.length>2500) return new Response(JSON.stringify({error:"Contexto muito longo."}),{status:400,headers:jsonHeaders});

    const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:auth}}});
    const {data:lead,error:le}=await sb.from("leads").select("id,name,company,value,status,origin,notes,next_contact,next_action").eq("id",leadId).single();
    if(le||!lead) return new Response(JSON.stringify({error:"Lead não encontrado ou sem acesso."}),{status:404,headers:jsonHeaders});
    const {data:acts}=await sb.from("lead_activities").select("kind,title,detail,metadata,created_at").eq("lead_id",leadId).order("created_at",{ascending:false}).limit(20);

    const stageHint:Stage = mode==="quick" ? detectStageQuick(conversation) : "1_amaciar";
    const sellingFuply=offerMode==="fuply"||norm(`${sellerContext} ${sellerMessage} ${extra}`).includes("fuply");
    const context={
      oferta:sellingFuply?"Fuply":"Outro produto/serviço", objetivo:GOALS[goal], modo:mode,
      etapaObrigatoriaSugeridaPeloServidor:stageHint,
      regraDaEtapa:"No modo rápido, siga esta etapa a menos que exista evidência explícita na mensagem que prove etapa posterior. Em dúvida, NÃO avance.",
      sinalAutomacao: mode==="quick"&&looksAuto(conversation),
      mensagemAnteriorDoVendedor:mode==="quick"?(sellerMessage||"não informada"):"na transcrição completa",
      respostaDoProspecto:mode==="quick"?conversation:"na transcrição completa",
      conversaCompleta:mode==="full"?conversation:"não fornecida",
      contextoExtra:extra||"nenhum",
      contextoDaOferta:sellingFuply?"Use a base oficial do Fuply":(sellerContext||"não informado"),
      lead:{nome:(lead as Lead).name,empresa:(lead as Lead).company,status:(lead as Lead).status,origem:(lead as Lead).origin,observacoes:String((lead as Lead).notes||"").slice(0,3500),proximaAcao:(lead as Lead).next_action,proximoContato:(lead as Lead).next_contact},
      historico:compact((acts||[]) as Activity[])
    };

    const instructions=`Você é o Copiloto de Vendas do Fuply. Sua principal função é escolher e escrever o PRÓXIMO PASSO CORRETO, sem tentar vender tudo de uma vez.\n\n${sellingFuply?FUPLY:"Use apenas o contexto fornecido para a oferta; não transfira funcionalidades do Fuply para outro produto."}\n\n${PROCEDURE}\n\nREGRAS DE INTERPRETAÇÃO\n- No modo rápido, a etapa sugerida pelo servidor é uma guarda de segurança. Respeite-a.\n- Se sinalAutomacao=true, stage deve ser 0_triagem, messageType deve ser automatic_greeting ou unknown, e você NÃO pode afirmar que foi robô nem pessoa.\n- Se o texto apenas dá permissão para continuar, stage=2_permissao. Não chame de sinal forte de compra.\n- Se pediu para mostrar, stage=4_mostrar e não peça autorização de novo.\n- Se pediu o que é/como funciona, stage=3_explicar.\n- Eventos "WhatsApp aberto" não provam envio, leitura ou resposta.\n- Uma mensagem preparada no histórico é intenção de envio, não prova de envio.\n- Se faltar preço/prazo/condição que o cliente perguntou e não estiver no contexto, needsMoreContext=true.\n\nESTILO\nPT-BR natural de WhatsApp. Curto. Uma ideia principal e um CTA. Sem "Perfeito!" automático, sem jargão corporativo, sem urgência falsa. Não invente fatos, preço, prazo, desconto, prova social, integração ou promessa.\nDireta = menor e objetiva; Consultiva = pergunta útil; Persuasiva = reforça valor real sem pressão.\nEm situation/historySummary, diferencie fato de suposição. objection deve ser "Nenhuma objeção clara" quando não houver objeção.\nEntregue somente o schema.`;

    let analysis:Analysis|null=null; let model=""; const errors:string[]=[];
    for(const m of MODELS){ try{ const a=await ask(m,instructions,context); if(mode==="quick"&&looksAuto(conversation)){a.stage="0_triagem";a.messageType="automatic_greeting";a.situation="Provável saudação automática ou institucional; não há evidência suficiente para saber se uma pessoa respondeu.";} analysis=a; model=m; break;}catch(e){errors.push(`${m}:${e instanceof Error?e.message:"erro"}`);} }
    if(!analysis) return new Response(JSON.stringify({error:"O Copiloto não conseguiu concluir a análise agora.",code:"AI_UNAVAILABLE",details:errors.slice(0,2)}),{status:503,headers:jsonHeaders});
    return new Response(JSON.stringify({...analysis,source:"openai",aiConfigured:true,model,historyItemsUsed:(acts||[]).length,stageHint}),{status:200,headers:jsonHeaders});
  }catch(e){ console.error(e); return new Response(JSON.stringify({error:"Erro inesperado no Copiloto."}),{status:500,headers:jsonHeaders}); }
});
