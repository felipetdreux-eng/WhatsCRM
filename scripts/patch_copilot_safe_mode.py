from pathlib import Path

path = Path('src/LeadReplyAssistant.jsx')
text = path.read_text(encoding='utf-8')

old = "    if (data?.source !== 'openai') throw new Error('A análise não veio do motor de IA esperado. Tente novamente.');"
new = "    if (!['openai', 'safe-procedure'].includes(data?.source)) throw new Error('O Copiloto retornou uma resposta inválida. Tente novamente.');"
if old not in text:
    raise SystemExit('source guard not found')
text = text.replace(old, new, 1)

old2 = "            <div className=\"reply-engine-badge active\"><Sparkles size={12} /> IA ativa · {result?.model || 'OpenAI'}</div>"
new2 = "            <div className={`reply-engine-badge ${result?.source === 'openai' ? 'active' : ''}`}><Sparkles size={12} /> {result?.source === 'openai' ? `IA ativa · ${result?.model || 'OpenAI'}` : 'Modo seguro · procedimento Fuply'}</div>"
if old2 not in text:
    raise SystemExit('engine badge not found')
text = text.replace(old2, new2, 1)

old3 = "          <div className=\"reply-message-type\">"
new3 = "          {result?.source === 'safe-procedure' && (\n            <div className=\"reply-context-note\"><AlertTriangle size={14} /><span>A OpenAI não respondeu nesta tentativa. O Fuply usou o procedimento de mensagens por etapa para não travar nem inventar contexto.</span></div>\n          )}\n\n          <div className=\"reply-message-type\">"
if old3 not in text:
    raise SystemExit('message type block not found')
text = text.replace(old3, new3, 1)

path.write_text(text, encoding='utf-8')
