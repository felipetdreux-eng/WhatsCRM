from pathlib import Path

# Temporary migration script. It is deleted after the fix is applied.

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: pattern not found')
    return text.replace(old, new, 1)

# App.jsx: no lead selected means open the explicit lead picker.
path = Path('src/App.jsx')
s = path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "  const openReplyAssistant = lead => {\n    const target = lead || selectedLead;\n    if (!target) {\n      openLeadsView({});\n      return;\n    }",
    "  const openReplyAssistant = lead => {\n    const target = lead || selectedLead;\n    if (!target) {\n      window.dispatchEvent(new CustomEvent('fuply:open-ai-selector'));\n      return;\n    }",
    'App AI fallback selector',
)
path.write_text(s, encoding='utf-8')

# CentralDoDia.jsx: never guess a lead from the daily queue.
path = Path('src/CentralDoDia.jsx')
s = path.read_text(encoding='utf-8')
s = s.replace("\n  const aiLead = data.queue[0]?.lead || data.active[0] || null;\n", "\n", 1)
s = replace_once(
    s,
    "        <button type=\"button\" className=\"home-ai-button\" onClick={() => aiLead ? onReplyWithAI?.(aiLead) : goFollowUps({})}>\n          <Sparkles size={16} /> {aiLead ? `Responder ${String(aiLead.name || '').split(' ')[0]} com IA` : 'Escolher um lead'}\n        </button>",
    "        <button type=\"button\" className=\"home-ai-button\" onClick={() => onReplyWithAI?.()}>\n          <Sparkles size={16} /> Escolher cliente e responder com IA\n        </button>",
    'Home AI explicit selector',
)
path.write_text(s, encoding='utf-8')

# GlobalQuickActions.jsx: listen for selector requests from anywhere in the app.
path = Path('src/GlobalQuickActions.jsx')
s = path.read_text(encoding='utf-8')
marker = """  useEffect(() => {\n    if (!open) {\n      setAiSelect(false);\n      setQuery('');\n      return;\n    }\n    window.setTimeout(() => inputRef.current?.focus(), 20);\n  }, [open]);\n"""
insert = marker + """\n  useEffect(() => {\n    const openAISelector = () => {\n      setAiSelect(true);\n      setQuery('');\n      setOpen(true);\n    };\n    window.addEventListener('fuply:open-ai-selector', openAISelector);\n    return () => window.removeEventListener('fuply:open-ai-selector', openAISelector);\n  }, []);\n"""
s = replace_once(s, marker, insert, 'Global AI selector listener')
path.write_text(s, encoding='utf-8')
