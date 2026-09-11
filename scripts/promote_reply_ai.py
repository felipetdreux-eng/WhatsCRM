from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: pattern not found')
    return text.replace(old, new, 1)

# App.jsx
path = Path('src/App.jsx')
s = path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "  const [followupError, setFollowupError] = useState('');\n",
    "  const [followupError, setFollowupError] = useState('');\n  const [replyAssistantSignal, setReplyAssistantSignal] = useState(0);\n",
    'App state',
)
s = replace_once(
    s,
    "  const openLead = lead => {\n    setSelectedLeadId(lead.id);\n    setEditingLead(null);\n    setFormError('');\n  };\n",
    "  const openLead = lead => {\n    setSelectedLeadId(lead.id);\n    setEditingLead(null);\n    setFormError('');\n  };\n\n  const openReplyAssistant = lead => {\n    const target = lead || selectedLead;\n    if (!target) {\n      openLeadsView({});\n      return;\n    }\n    setSelectedLeadId(target.id);\n    setEditingLead(null);\n    setFormError('');\n    setReplyAssistantSignal(signal => signal + 1);\n  };\n",
    'App reply opener',
)
s = replace_once(
    s,
    "          <div className=\"detail-top-actions\">\n            <button type=\"button\" className=\"primary-button\" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir WhatsApp</button>\n          </div>",
    "          <div className=\"detail-top-actions\">\n            <button type=\"button\" className=\"ai-top-button\" onClick={() => openReplyAssistant(selectedLead)}><Sparkles size={17} /> Responder com IA</button>\n            <button type=\"button\" className=\"secondary-button detail-top-whatsapp\" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir WhatsApp</button>\n          </div>",
    'App top actions',
)
hero_end = """          <div className=\"detail-value\">\n            <span>{selectedLead.status === 'Fechado' ? 'Valor fechado' : 'Valor potencial'}</span>\n            <strong>{currency(selectedLead.status === 'Fechado' ? selectedLead.saleValue : selectedLead.value)}</strong>\n          </div>\n        </section>\n\n        {editingLead ? ("""
hero_new = """          <div className=\"detail-value\">\n            <span>{selectedLead.status === 'Fechado' ? 'Valor fechado' : 'Valor potencial'}</span>\n            <strong>{currency(selectedLead.status === 'Fechado' ? selectedLead.saleValue : selectedLead.value)}</strong>\n          </div>\n        </section>\n\n        <LeadReplyAssistant lead={selectedLead} openWhatsApp={openWhatsApp} openSignal={replyAssistantSignal} />\n\n        {editingLead ? ("""
s = replace_once(s, hero_end, hero_new, 'App move assistant')
s = s.replace("\n              <LeadReplyAssistant lead={selectedLead} openWhatsApp={openWhatsApp} />\n", "\n", 1)
s = replace_once(
    s,
    "                  <button type=\"button\" className=\"detail-whatsapp\" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir conversa no WhatsApp</button>\n                  {selectedLead.status !== 'Fechado'",
    "                  <button type=\"button\" className=\"detail-whatsapp\" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir conversa no WhatsApp</button>\n                  <button type=\"button\" className=\"detail-action ai-action\" onClick={() => openReplyAssistant(selectedLead)}><Sparkles size={17} /> Responder com IA</button>\n                  {selectedLead.status !== 'Fechado'",
    'App detail action',
)
s = replace_once(
    s,
    "if (activePage === 'Início') return <CentralDoDia leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => openPipelineView()} goFollowUps={openLeadsView} goAutopilot={() => setActivePage('Autopilot 2.0')} />;",
    "if (activePage === 'Início') return <CentralDoDia leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => openPipelineView()} goFollowUps={openLeadsView} goAutopilot={() => setActivePage('Autopilot 2.0')} onReplyWithAI={openReplyAssistant} />;",
    'App home props',
)
s = replace_once(
    s,
    "<GlobalQuickActions leads={leads} onNewLead={() => openNewLead()} onNavigate={navigate} onOpenLead={openLead} onOpenLeads={openLeadsView} />",
    "<GlobalQuickActions leads={leads} onNewLead={() => openNewLead()} onNavigate={navigate} onOpenLead={openLead} onOpenLeads={openLeadsView} onReplyWithAI={openReplyAssistant} />",
    'App quick props',
)
path.write_text(s, encoding='utf-8')

# LeadReplyAssistant.jsx
path = Path('src/LeadReplyAssistant.jsx')
s = path.read_text(encoding='utf-8')
s = replace_once(s, "import React, { useMemo, useState } from 'react';", "import React, { useEffect, useMemo, useRef, useState } from 'react';", 'assistant imports')
s = replace_once(s, "export default function LeadReplyAssistant({ lead, openWhatsApp }) {", "export default function LeadReplyAssistant({ lead, openWhatsApp, openSignal = 0 }) {", 'assistant props')
s = replace_once(
    s,
    "  const [error, setError] = useState('');\n\n  const reply = useMemo",
    "  const [error, setError] = useState('');\n  const sectionRef = useRef(null);\n\n  useEffect(() => {\n    if (!openSignal) return;\n    setOpen(true);\n    window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);\n  }, [openSignal]);\n\n  const reply = useMemo",
    'assistant signal effect',
)
s = s.replace('<section className="detail-card reply-assistant-collapsed">', '<section ref={sectionRef} id="reply-assistant" className="detail-card reply-assistant-collapsed">', 1)
s = s.replace('<section className="detail-card reply-assistant-card">', '<section ref={sectionRef} id="reply-assistant" className="detail-card reply-assistant-card">', 1)
s = s.replace('<strong>Não sabe o que responder?</strong>', '<strong>Assistente de Vendas IA</strong>', 1)
s = s.replace('Cole a mensagem do cliente e o Fuply sugere como continuar a conversa.', 'Cole a mensagem do cliente. A IA analisa a negociação e monta sua próxima resposta.', 1)
s = s.replace('<Sparkles size={16} /> Me ajuda a responder</button>', '<Sparkles size={16} /> Responder com IA</button>', 1)
s = s.replace('<h2><Sparkles size={17} /> Me ajuda a responder</h2>', '<h2><Sparkles size={17} /> Responder com IA</h2>', 1)
path.write_text(s, encoding='utf-8')

# CentralDoDia.jsx
path = Path('src/CentralDoDia.jsx')
s = path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "export default function CentralDoDia({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps, goAutopilot }) {",
    "export default function CentralDoDia({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps, goAutopilot, onReplyWithAI }) {",
    'home props',
)
s = replace_once(
    s,
    "  const startDay = () => {\n    if (data.queue[0]?.lead) openLead(data.queue[0].lead);\n    else goPipeline();\n  };\n",
    "  const startDay = () => {\n    if (data.queue[0]?.lead) openLead(data.queue[0].lead);\n    else goPipeline();\n  };\n\n  const aiLead = data.queue[0]?.lead || data.active[0] || null;\n",
    'home ai lead',
)
marker = """      <section className=\"daily-hero\">"""
spotlight = """      <section className=\"home-ai-spotlight\">\n        <div className=\"home-ai-icon\"><Sparkles size={22} /></div>\n        <div className=\"home-ai-copy\">\n          <span>Assistente de Vendas IA</span>\n          <h2>Cliente respondeu? Descubra o que dizer para avançar a venda.</h2>\n          <p>Cole a mensagem recebida e o Fuply identifica objeções, sugere estratégia e cria três respostas prontas para WhatsApp.</p>\n        </div>\n        <button type=\"button\" className=\"home-ai-button\" onClick={() => aiLead ? onReplyWithAI?.(aiLead) : goFollowUps({})}>\n          <Sparkles size={16} /> {aiLead ? `Responder ${String(aiLead.name || '').split(' ')[0]} com IA` : 'Escolher um lead'}\n        </button>\n      </section>\n\n      <section className=\"daily-hero\">"""
s = replace_once(s, marker, spotlight, 'home spotlight')
path.write_text(s, encoding='utf-8')

# GlobalQuickActions.jsx
path = Path('src/GlobalQuickActions.jsx')
s = path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "  { id: 'home', label: 'Ir para Início', hint: 'Central do Dia', icon: CalendarClock },",
    "  { id: 'home', label: 'Ir para Início', hint: 'Central do Dia', icon: CalendarClock },\n  { id: 'reply-ai', label: 'Responder cliente com IA', hint: 'analise a mensagem e gere a resposta', icon: Sparkles },",
    'quick ai command',
)
s = replace_once(
    s,
    "export default function GlobalQuickActions({ leads, onNewLead, onNavigate, onOpenLead, onOpenLeads }) {\n  const [open, setOpen] = useState(false);\n  const [query, setQuery] = useState('');",
    "export default function GlobalQuickActions({ leads, onNewLead, onNavigate, onOpenLead, onOpenLeads, onReplyWithAI }) {\n  const [open, setOpen] = useState(false);\n  const [query, setQuery] = useState('');\n  const [aiSelect, setAiSelect] = useState(false);",
    'quick props state',
)
s = replace_once(
    s,
    "  useEffect(() => {\n    if (!open) return;\n    window.setTimeout(() => inputRef.current?.focus(), 20);\n  }, [open]);",
    "  useEffect(() => {\n    if (!open) {\n      setAiSelect(false);\n      setQuery('');\n      return;\n    }\n    window.setTimeout(() => inputRef.current?.focus(), 20);\n  }, [open]);",
    'quick open effect',
)
s = replace_once(
    s,
    "  const runCommand = id => {\n    setOpen(false);\n    setQuery('');",
    "  const runCommand = id => {\n    if (id === 'reply-ai') {\n      setAiSelect(true);\n      setQuery('');\n      return;\n    }\n    setOpen(false);\n    setQuery('');",
    'quick run command',
)
s = replace_once(
    s,
    "  const openLead = lead => {\n    setOpen(false);\n    setQuery('');\n    onOpenLead(lead);\n  };",
    "  const openLead = lead => {\n    setOpen(false);\n    setQuery('');\n    if (aiSelect) onReplyWithAI?.(lead);\n    else onOpenLead(lead);\n  };\n\n  const openAISelector = () => {\n    setAiSelect(true);\n    setQuery('');\n    setOpen(true);\n  };",
    'quick select lead',
)
s = replace_once(
    s,
    "        <button type=\"button\" className=\"global-search-launcher\" onClick={() => setOpen(true)} title=\"Buscar no Fuply (⌘K)\"><Search size={18} /><span>Buscar</span><kbd>⌘K</kbd></button>\n        <button type=\"button\" className=\"global-add-lead\"",
    "        <button type=\"button\" className=\"global-search-launcher\" onClick={() => setOpen(true)} title=\"Buscar no Fuply (⌘K)\"><Search size={18} /><span>Buscar</span><kbd>⌘K</kbd></button>\n        <button type=\"button\" className=\"global-ai-launcher\" onClick={openAISelector} title=\"Responder cliente com IA\"><Sparkles size={18} /><span>IA</span></button>\n        <button type=\"button\" className=\"global-add-lead\"",
    'quick floating ai',
)
s = replace_once(
    s,
    "<input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder=\"Buscar lead, empresa, telefone ou ação...\" />",
    "<input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder={aiSelect ? 'Qual cliente respondeu?' : 'Buscar lead, empresa, telefone ou ação...'} />",
    'quick placeholder',
)
s = replace_once(
    s,
    "            <div className=\"command-section\">\n              <span className=\"command-section-title\">Ações</span>\n              {commands.map(command => {\n                const Icon = command.icon;\n                return <button type=\"button\" className=\"command-row\" key={command.id} onClick={() => runCommand(command.id)}><Icon size={17} /><div><strong>{command.label}</strong><span>{command.hint}</span></div></button>;\n              })}\n            </div>\n            <div className=\"command-section\">\n              <span className=\"command-section-title\">Leads</span>",
    "            {!aiSelect ? (\n              <div className=\"command-section\">\n                <span className=\"command-section-title\">Ações</span>\n                {commands.map(command => {\n                  const Icon = command.icon;\n                  return <button type=\"button\" className=\"command-row\" key={command.id} onClick={() => runCommand(command.id)}><Icon size={17} /><div><strong>{command.label}</strong><span>{command.hint}</span></div></button>;\n                })}\n              </div>\n            ) : (\n              <div className=\"command-intent-note\"><Sparkles size={17} /><div><strong>Responder com IA</strong><span>Escolha o cliente que acabou de responder.</span></div><button type=\"button\" onClick={() => setAiSelect(false)}>Voltar</button></div>\n            )}\n            <div className=\"command-section\">\n              <span className=\"command-section-title\">{aiSelect ? 'Escolha o lead' : 'Leads'}</span>",
    'quick sections',
)
s = replace_once(
    s,
    "{matches.length ? matches.map(lead => <button type=\"button\" className=\"command-row\" key={lead.id} onClick={() => openLead(lead)}><MessageCircle size={17} /><div><strong>{lead.name}</strong><span>{lead.company || lead.phone} · {lead.status}</span></div></button>)",
    "{matches.length ? matches.map(lead => <button type=\"button\" className=\"command-row\" key={lead.id} onClick={() => openLead(lead)}>{aiSelect ? <Sparkles size={17} /> : <MessageCircle size={17} />}<div><strong>{lead.name}</strong><span>{aiSelect ? 'Abrir Assistente de Vendas IA' : `${lead.company || lead.phone} · ${lead.status}`}</span></div></button>)",
    'quick lead row',
)
path.write_text(s, encoding='utf-8')

# usability.css append
path = Path('src/usability.css')
s = path.read_text(encoding='utf-8')
addition = r'''
.global-ai-launcher{height:46px;border:0;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:0 14px;display:flex;align-items:center;gap:7px;box-shadow:0 12px 30px rgba(124,58,237,.3);font-size:10px;font-weight:900}.global-ai-launcher:hover{transform:translateY(-1px);filter:brightness(1.05)}.ai-top-button{border:0;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:9px 13px;display:inline-flex;align-items:center;gap:7px;font-size:9.5px;font-weight:900;box-shadow:0 7px 18px rgba(124,58,237,.2)}.ai-top-button:hover{filter:brightness(1.06)}.detail-top-actions{display:flex;align-items:center;gap:8px}.detail-action.ai-action{border-color:#d9c8ff;background:#f6f1ff;color:#6d28d9;font-weight:900}.home-ai-spotlight{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;margin-bottom:14px;padding:16px 17px;border:1px solid #dacbff;border-radius:15px;background:linear-gradient(135deg,#faf7ff,#f4efff);box-shadow:0 8px 24px rgba(91,33,182,.07)}.home-ai-icon{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(124,58,237,.22)}.home-ai-copy>span{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#7c3aed}.home-ai-copy h2{margin:3px 0 4px;font-size:13px;color:#1f2937}.home-ai-copy p{margin:0;font-size:9px;line-height:1.5;color:#667085}.home-ai-button{border:0;border-radius:10px;background:#6d28d9;color:#fff;padding:10px 12px;display:flex;align-items:center;gap:6px;font-size:9px;font-weight:900;white-space:nowrap}.home-ai-button:hover{background:#5b21b6}.command-intent-note{margin:10px;padding:10px 11px;border:1px solid #dacbff;border-radius:11px;background:#f7f2ff;display:flex;align-items:center;gap:9px;color:#6d28d9}.command-intent-note>div{display:flex;flex:1;flex-direction:column;gap:2px}.command-intent-note strong{font-size:10px}.command-intent-note span{font-size:8.5px;color:#7c6b97}.command-intent-note button{border:0;background:transparent;color:#6d28d9;font-size:8.5px;font-weight:800}.detail-content>.reply-assistant-collapsed{margin-bottom:14px;border-color:#dacbff;background:linear-gradient(135deg,#fff,#faf7ff)}.detail-content>.reply-assistant-card{margin-bottom:14px;border-color:#dacbff}html[data-theme="dark"] .home-ai-spotlight,html[data-theme="dark"] .command-intent-note,html[data-theme="dark"] .detail-action.ai-action,html[data-theme="dark"] .detail-content>.reply-assistant-collapsed{background:#211a2d;border-color:#4e3a6d;color:#e9ddff}html[data-theme="dark"] .home-ai-copy h2{color:#f3effa}html[data-theme="dark"] .home-ai-copy p,html[data-theme="dark"] .command-intent-note span{color:#b7adc7}@media(max-width:760px){.global-ai-launcher{width:46px;padding:0;justify-content:center}.global-ai-launcher span{display:none}.home-ai-spotlight{grid-template-columns:auto 1fr}.home-ai-button{grid-column:1/-1;justify-content:center}.detail-top-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.detail-top-actions button{justify-content:center}}
'''.strip()
if '.global-ai-launcher{' not in s:
    s = s.rstrip() + '\n' + addition + '\n'
path.write_text(s, encoding='utf-8')

print('Promoted AI reply assistant across Fuply')
