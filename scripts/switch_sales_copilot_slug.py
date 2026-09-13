from pathlib import Path

path = Path('src/LeadReplyAssistant.jsx')
text = path.read_text(encoding='utf-8')
old = "supabase.functions.invoke('sales-assistant', {"
new = "supabase.functions.invoke('sales-copilot', {"
if old not in text:
    raise SystemExit('sales assistant invoke not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
