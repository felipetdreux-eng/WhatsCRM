from pathlib import Path

path = Path('src/styles.css')
text = path.read_text(encoding='utf-8')
old = ".logo-wrap{display:flex;align-items:center;gap:10px;padding:0 8px 26px;font-size:22px;font-weight:700;letter-spacing:-.04em}"
new = ".logo-wrap{display:flex;align-items:center;gap:11px;padding:0 8px 27px;font-size:27px;font-weight:800;letter-spacing:-.045em}"
if old not in text:
    raise SystemExit('logo-wrap style not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Fuply sidebar brand resized from 22px to 27px.')
