from pathlib import Path

path = Path('src/App.jsx')
text = path.read_text(encoding='utf-8')
old = "{ hasMessage: Boolean(message), source: options?.source || 'app' },"
new = "{ hasMessage: Boolean(message), source: options?.source || 'app', preparedMessage: message ? String(message).slice(0, 1800) : '' },"
if old not in text:
    raise SystemExit('openWhatsApp activity metadata pattern not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
