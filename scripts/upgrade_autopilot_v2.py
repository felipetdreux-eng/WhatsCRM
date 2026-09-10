from pathlib import Path

# --- autopilotEngine.js -------------------------------------------------------
engine_path = Path('src/autopilotEngine.js')
engine = engine_path.read_text(encoding='utf-8')
anchor = """export function buildAutopilotQueue(leads, { now = new Date(), limit = 12 } = {}) {\n"""
if 'export function autopilotMessageSuggestion' not in engine:
    addition = r'''function firstName(value) {
  const name = String(value || '').trim();
  return name ? name.split(/\s+/)[0] : 'tudo bem';
}

export function autopilotMessageSuggestion(item, tone = 'direct') {
  if (!item?.lead) return '';
  const lead = item.lead;
  const name = firstName(lead.name);
  const status = lead.status || 'Novo lead';
  const overdue = item.due != null && item.due < 0;
  const veryCold = item.idleDays >= 7;

  if (tone === 'last') {
    if (status === 'Proposta enviada' || status === 'Negociação') {
      return `Oi, ${name}! Vou encerrar meu acompanhamento por aqui para não ficar te cobrando. Antes disso, queria confirmar: ainda faz sentido avançarmos ou prefere deixar para outro momento?`;
    }
    return `Oi, ${name}! Passando uma última vez para saber se ainda faz sentido continuarmos essa conversa. Se não for prioridade agora, sem problema, só me avisa para eu organizar por aqui.`;
  }

  if (tone === 'light') {
    if (status === 'Novo lead') {
      return `Oi, ${name}! Tudo bem? Vi seu contato por aqui e queria entender melhor o que você está buscando. Posso te fazer uma pergunta rápida?`;
    }
    if (status === 'Proposta enviada') {
      return `Oi, ${name}! Tudo bem? Passando rapidinho para saber se conseguiu dar uma olhada na proposta. Se ficou alguma dúvida, posso te ajudar por aqui.`;
    }
    if (status === 'Negociação') {
      return `Oi, ${name}! Tudo certo? Queria retomar nossa conversa e ver se ficou algum ponto para ajustarmos antes de avançar.`;
    }
    if (veryCold) {
      return `Oi, ${name}! Faz um tempinho que não nos falamos. Queria saber se isso ainda está nos seus planos ou se prefere retomar mais para frente.`;
    }
    return `Oi, ${name}! Tudo bem? Passando para retomar nossa conversa. Ainda faz sentido falarmos sobre isso?`;
  }

  if (overdue) {
    if (status === 'Proposta enviada') {
      return `Oi, ${name}! Nosso retorno ficou pendente. Você conseguiu analisar a proposta? Se tiver algum ponto travando a decisão, me fala que eu tento resolver por aqui.`;
    }
    if (status === 'Negociação') {
      return `Oi, ${name}! Nosso retorno ficou pendente. Queria fechar os próximos passos da negociação. O que falta definirmos para conseguir avançar?`;
    }
    return `Oi, ${name}! Nosso retorno ficou pendente e estou retomando por aqui. Ainda faz sentido avançarmos nessa conversa?`;
  }

  if (status === 'Novo lead') {
    return `Oi, ${name}! Tudo bem? Vi seu contato por aqui e queria entender melhor o que você precisa. Posso te fazer uma pergunta rápida para ver se consigo ajudar?`;
  }
  if (status === 'Interessado') {
    return `Oi, ${name}! Queria retomar o que conversamos. Pelo que entendi, existe interesse. Qual é o principal ponto que você precisa resolver para conseguirmos avançar?`;
  }
  if (status === 'Proposta enviada') {
    return `Oi, ${name}! Conseguiu analisar a proposta? Se tiver algum ponto travando a decisão, me fala que eu tento resolver por aqui.`;
  }
  if (status === 'Negociação') {
    return `Oi, ${name}! Queria fechar os próximos passos da nossa negociação. O que falta definirmos para conseguir avançar?`;
  }
  if (veryCold) {
    return `Oi, ${name}! Faz alguns dias que não nos falamos. Ainda faz sentido seguirmos com essa conversa? Se sim, eu organizo o próximo passo por aqui.`;
  }
  return `Oi, ${name}! Passando para retomar nosso contato. Ainda faz sentido conversarmos sobre isso?`;
}

'''
    if anchor not in engine:
        raise SystemExit('autopilot engine anchor not found')
    engine = engine.replace(anchor, addition + anchor, 1)
    engine_path.write_text(engine, encoding='utf-8')

# --- Autopilot.jsx ------------------------------------------------------------
auto_path = Path('src/Autopilot.jsx')
auto = auto_path.read_text(encoding='utf-8')

old_imports = """  CalendarClock,\n  CheckCircle2,\n  ChevronRight,\n  Clock3,\n  Flame,\n  ListChecks,\n  MessageCircle,\n  RotateCcw,\n  Sparkles,\n  Target,\n  X,\n} from 'lucide-react';\nimport { autopilotRecommendation, buildAutopilotQueue as buildSmartAutopilotQueue } from './autopilotEngine';\nimport './autopilot.css';\nimport './autopilot-outcome.css';\n"""
new_imports = """  CalendarClock,\n  Check,\n  CheckCircle2,\n  ChevronRight,\n  Clock3,\n  Copy,\n  Flame,\n  ListChecks,\n  MessageCircle,\n  RotateCcw,\n  Sparkles,\n  Target,\n  WandSparkles,\n  X,\n} from 'lucide-react';\nimport { autopilotMessageSuggestion, autopilotRecommendation, buildAutopilotQueue as buildSmartAutopilotQueue } from './autopilotEngine';\nimport './autopilot.css';\nimport './autopilot-outcome.css';\nimport './autopilot-v2.css';\n"""
if old_imports not in auto:
    raise SystemExit('Autopilot import block not found')
auto = auto.replace(old_imports, new_imports, 1)

old_state = """  const [followupAction, setFollowupAction] = useState('');\n  const [outcomeError, setOutcomeError] = useState('');\n\n  const remaining = sessionQueue.filter(item => !handled.includes(item.lead.id));\n"""
new_state = """  const [followupAction, setFollowupAction] = useState('');\n  const [outcomeError, setOutcomeError] = useState('');\n  const [messageTone, setMessageTone] = useState('direct');\n  const [draftMessage, setDraftMessage] = useState('');\n  const [copiedMessage, setCopiedMessage] = useState(false);\n\n  const remaining = sessionQueue.filter(item => !handled.includes(item.lead.id));\n"""
if old_state not in auto:
    raise SystemExit('Autopilot state block not found')
auto = auto.replace(old_state, new_state, 1)

old_open_reset = """      setFollowupAction('');\n      setOutcomeError('');\n    }\n  }, [open]);\n"""
new_open_reset = """      setFollowupAction('');\n      setOutcomeError('');\n      setMessageTone('direct');\n      setDraftMessage('');\n      setCopiedMessage(false);\n    }\n  }, [open]);\n"""
if old_open_reset not in auto:
    raise SystemExit('Autopilot open reset block not found')
auto = auto.replace(old_open_reset, new_open_reset, 1)

old_current_reset = """    setFollowupAction('');\n    setOutcomeError('');\n  }, [current?.lead.id]);\n"""
new_current_reset = """    setFollowupAction('');\n    setOutcomeError('');\n    setMessageTone('direct');\n    setDraftMessage(autopilotMessageSuggestion(current, 'direct'));\n    setCopiedMessage(false);\n  }, [current?.lead.id]);\n"""
if old_current_reset not in auto:
    raise SystemExit('Autopilot current reset block not found')
auto = auto.replace(old_current_reset, new_current_reset, 1)

old_contact = """  const contact = () => {\n    if (!current) return;\n    const opened = openWhatsApp(current.lead, '', { skipFollowupPrompt: true, source: 'autopilot' });\n    if (opened === false) {\n      setOutcomeError('Esse lead não tem um WhatsApp válido para abrir.');\n      return;\n    }\n    setWhatsapps(value => value + 1);\n    setAwaitingOutcome(true);\n    setSelectedOutcomeId('');\n    setSaleValue(String(Number(current.lead.value || 0) > 0 ? Number(current.lead.value) : ''));\n    setFollowupDate('');\n    setFollowupAction('');\n    setOutcomeError('');\n  };\n\n  const chooseOutcome = id => {\n"""
new_contact = """  const contact = (message = '') => {\n    if (!current) return;\n    const opened = openWhatsApp(current.lead, typeof message === 'string' ? message.trim() : '', { skipFollowupPrompt: true, source: 'autopilot-v2' });\n    if (opened === false) {\n      setOutcomeError('Esse lead não tem um WhatsApp válido para abrir.');\n      return;\n    }\n    setWhatsapps(value => value + 1);\n    setAwaitingOutcome(true);\n    setSelectedOutcomeId('');\n    setSaleValue(String(Number(current.lead.value || 0) > 0 ? Number(current.lead.value) : ''));\n    setFollowupDate('');\n    setFollowupAction('');\n    setOutcomeError('');\n  };\n\n  const chooseMessageTone = tone => {\n    if (!current) return;\n    setMessageTone(tone);\n    setDraftMessage(autopilotMessageSuggestion(current, tone));\n    setCopiedMessage(false);\n  };\n\n  const copyMessage = async () => {\n    if (!draftMessage.trim()) return;\n    try {\n      await navigator.clipboard.writeText(draftMessage.trim());\n      setCopiedMessage(true);\n      window.setTimeout(() => setCopiedMessage(false), 1600);\n    } catch {\n      setOutcomeError('Não foi possível copiar a mensagem automaticamente.');\n    }\n  };\n\n  const chooseOutcome = id => {\n"""
if old_contact not in auto:
    raise SystemExit('Autopilot contact block not found')
auto = auto.replace(old_contact, new_contact, 1)

old_restart = """    setFollowupAction('');\n    setOutcomeError('');\n  };\n\n  return (\n"""
new_restart = """    setFollowupAction('');\n    setOutcomeError('');\n    setMessageTone('direct');\n    setDraftMessage('');\n    setCopiedMessage(false);\n  };\n\n  return (\n"""
if old_restart not in auto:
    raise SystemExit('Autopilot restart block not found')
auto = auto.replace(old_restart, new_restart, 1)

auto = auto.replace(
    '<div><strong>Fuply Autopilot</strong><small>Modo execução · decide a ordem, você fecha a venda</small></div>',
    '<div><strong>Fuply Autopilot 2.0</strong><small>Prioriza o lead, explica o motivo e prepara a abordagem</small></div>',
    1,
)

old_suggestion_actions = """                  <div className=\"autopilot-suggestion\">\n                    <div className=\"autopilot-suggestion-icon\"><Sparkles size={19} /></div>\n                    <div><span>Faça isso agora</span><strong>{suggestion.title}</strong><p>{suggestion.detail}</p></div>\n                  </div>\n\n                  <div className=\"autopilot-actions\">\n                    <button type=\"button\" className=\"autopilot-whatsapp\" onClick={contact}><MessageCircle size={18} /> Abrir WhatsApp <ArrowRight size={16} /></button>\n                    <button type=\"button\" className=\"autopilot-inspect\" onClick={inspect}>Ver negociação</button>\n                    <button type=\"button\" className=\"autopilot-skip\" onClick={skip}>Pular por agora</button>\n                  </div>\n"""
new_suggestion_actions = """                  <div className=\"autopilot-suggestion\">\n                    <div className=\"autopilot-suggestion-icon\"><Sparkles size={19} /></div>\n                    <div><span>Faça isso agora</span><strong>{suggestion.title}</strong><p>{suggestion.detail}</p></div>\n                  </div>\n\n                  <section className=\"autopilot-message-assistant\" aria-label=\"Mensagem sugerida pelo Autopilot\">\n                    <div className=\"autopilot-message-head\">\n                      <div><span><WandSparkles size={14} /> Mensagem sugerida</span><strong>Abordagem pronta para este momento da negociação</strong></div>\n                      <div className=\"autopilot-message-tones\" aria-label=\"Estilo da mensagem\">\n                        <button type=\"button\" className={messageTone === 'direct' ? 'active' : ''} onClick={() => chooseMessageTone('direct')}>Direta</button>\n                        <button type=\"button\" className={messageTone === 'light' ? 'active' : ''} onClick={() => chooseMessageTone('light')}>Leve</button>\n                        <button type=\"button\" className={messageTone === 'last' ? 'active' : ''} onClick={() => chooseMessageTone('last')}>Última tentativa</button>\n                      </div>\n                    </div>\n                    <textarea value={draftMessage} onChange={event => { setDraftMessage(event.target.value); setCopiedMessage(false); }} aria-label=\"Editar mensagem sugerida\" />\n                    <div className=\"autopilot-message-foot\">\n                      <span>Você pode editar antes de abrir o WhatsApp. O Fuply nunca envia sozinho.</span>\n                      <button type=\"button\" onClick={copyMessage}>{copiedMessage ? <Check size={14} /> : <Copy size={14} />}{copiedMessage ? 'Copiada' : 'Copiar'}</button>\n                    </div>\n                  </section>\n\n                  <div className=\"autopilot-actions autopilot-actions-v2\">\n                    <button type=\"button\" className=\"autopilot-whatsapp\" onClick={() => contact(draftMessage)} disabled={!draftMessage.trim()}><MessageCircle size={18} /> Abrir com mensagem <ArrowRight size={16} /></button>\n                    <button type=\"button\" className=\"autopilot-inspect\" onClick={() => contact('')}><MessageCircle size={16} /> Só abrir WhatsApp</button>\n                    <button type=\"button\" className=\"autopilot-inspect\" onClick={inspect}>Ver negociação</button>\n                    <button type=\"button\" className=\"autopilot-skip\" onClick={skip}>Pular por agora</button>\n                  </div>\n"""
if old_suggestion_actions not in auto:
    raise SystemExit('Autopilot suggestion/action block not found')
auto = auto.replace(old_suggestion_actions, new_suggestion_actions, 1)

# The outcome view calls contact directly from onClick; wrap it so React's click event is not treated as message text.
auto = auto.replace('onClick={contact}><MessageCircle size={16} /> Abrir WhatsApp de novo</button>', "onClick={() => contact('')}><MessageCircle size={16} /> Abrir WhatsApp de novo</button>", 1)

auto_path.write_text(auto, encoding='utf-8')

# --- Autopilot 2.0 CSS --------------------------------------------------------
css = r'''.autopilot-message-assistant{margin-top:14px;border:1px solid #d9e4de;border-radius:15px;background:#fff;padding:13px 14px;box-shadow:0 5px 18px rgba(16,24,40,.035)}
.autopilot-message-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.autopilot-message-head>div:first-child>span{display:flex;align-items:center;gap:5px;color:#0f7a50;font-size:8.7px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.autopilot-message-head>div:first-child>strong{display:block;color:#344054;font-size:10.5px;margin-top:4px}.autopilot-message-tones{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.autopilot-message-tones button{border:1px solid #dfe6e2;background:#f8faf9;color:#667085;border-radius:999px;padding:6px 8px;font-size:8.5px;font-weight:750;cursor:pointer}.autopilot-message-tones button:hover{border-color:#b9d7c7;color:#0f7a50}.autopilot-message-tones button.active{background:#eaf8f1;border-color:#9fd1b7;color:#0f7a50}.autopilot-message-assistant textarea{display:block;width:100%;min-height:86px;resize:vertical;border:1px solid #dfe6e2;border-radius:11px;background:#fbfcfb;color:#26332d;padding:10px 11px;font:inherit;font-size:10px;line-height:1.55;outline:none}.autopilot-message-assistant textarea:focus{border-color:#70bd96;box-shadow:0 0 0 3px rgba(22,163,106,.09);background:#fff}.autopilot-message-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}.autopilot-message-foot>span{font-size:8.3px;color:#8a94a2;line-height:1.4}.autopilot-message-foot button{border:1px solid #dbe5df;background:#fff;color:#475467;border-radius:8px;min-height:31px;padding:0 9px;display:inline-flex;align-items:center;gap:5px;font-size:8.8px;font-weight:800;cursor:pointer;white-space:nowrap}.autopilot-message-foot button:hover{background:#f5fbf8;border-color:#b9d7c7;color:#0f7a50}.autopilot-actions-v2{grid-template-columns:1.5fr 1.05fr 1fr auto}.autopilot-actions-v2 .autopilot-whatsapp:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}
html[data-theme="dark"] .autopilot-message-assistant{background:#171c21;border-color:#303a35;box-shadow:none}html[data-theme="dark"] .autopilot-message-head>div:first-child>span{color:#71dda5}html[data-theme="dark"] .autopilot-message-head>div:first-child>strong{color:#dce3e8}html[data-theme="dark"] .autopilot-message-tones button{background:#11161a;border-color:#313a43;color:#a5afb9}html[data-theme="dark"] .autopilot-message-tones button.active{background:#173326;border-color:#356348;color:#7ce0aa}html[data-theme="dark"] .autopilot-message-assistant textarea{background:#101419;border-color:#313941;color:#e7edf1}html[data-theme="dark"] .autopilot-message-assistant textarea:focus{border-color:#3f9368;box-shadow:0 0 0 3px rgba(44,196,126,.08)}html[data-theme="dark"] .autopilot-message-foot>span{color:#929ca8}html[data-theme="dark"] .autopilot-message-foot button{background:#11161a;border-color:#313a43;color:#c8d0d7}
@media(max-width:900px){.autopilot-message-head{flex-direction:column}.autopilot-message-tones{justify-content:flex-start}.autopilot-actions-v2{grid-template-columns:1fr 1fr}.autopilot-actions-v2 .autopilot-skip{grid-column:1/-1}}
@media(max-width:620px){.autopilot-message-assistant{padding:11px}.autopilot-message-tones{width:100%}.autopilot-message-tones button{flex:1}.autopilot-actions-v2{grid-template-columns:1fr}.autopilot-actions-v2 .autopilot-skip{grid-column:auto}.autopilot-message-foot{align-items:flex-start}.autopilot-message-assistant textarea{min-height:104px}}
'''
Path('src/autopilot-v2.css').write_text(css, encoding='utf-8')

# --- tests --------------------------------------------------------------------
test_path = Path('tests/autopilot.test.js')
tests = test_path.read_text(encoding='utf-8')
tests = tests.replace(
    "import { buildAutopilotQueue, scoreAutopilotLead } from '../src/autopilotEngine.js';",
    "import { autopilotMessageSuggestion, buildAutopilotQueue, scoreAutopilotLead } from '../src/autopilotEngine.js';",
    1,
)
if "autopilot 2.0 gera mensagem contextual" not in tests:
    tests += r'''

test('autopilot 2.0 gera mensagem contextual para proposta', () => {
  const item = scoreAutopilotLead(lead({
    name: 'Adriano Cardoso',
    status: 'Proposta enviada',
    nextContact: '2030-01-14',
    updatedAt: '2030-01-13T12:00:00.000Z',
  }), NOW);
  const message = autopilotMessageSuggestion(item, 'direct');
  assert.match(message, /Adriano/);
  assert.match(message.toLowerCase(), /proposta/);
});

test('autopilot 2.0 oferece abordagem leve e última tentativa diferentes', () => {
  const item = scoreAutopilotLead(lead({
    name: 'Marina Lopes',
    status: 'Contatado',
    nextContact: '',
    updatedAt: '2030-01-05T12:00:00.000Z',
  }), NOW);
  const light = autopilotMessageSuggestion(item, 'light');
  const last = autopilotMessageSuggestion(item, 'last');
  assert.notEqual(light, last);
  assert.match(light, /Marina/);
  assert.match(last.toLowerCase(), /última|organizar/);
});
'''
    test_path.write_text(tests, encoding='utf-8')

print('Autopilot 2.0 patch applied.')