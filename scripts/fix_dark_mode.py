from pathlib import Path

main = Path('src/main.jsx')
text = main.read_text()

if "import './dark.css';" not in text:
    text = text.replace("import './pipelineDragScroll';\n", "import './pipelineDragScroll';\nimport './dark.css';\nimport './dark-integrated.css';\n", 1)

needle = "const activeAccount = getActiveAccount();\n"
replacement = "const activeAccount = getActiveAccount();\ndocument.documentElement.dataset.theme = activeAccount?.theme === 'dark' ? 'dark' : 'light';\n"
if replacement not in text:
    if needle not in text:
        raise SystemExit('activeAccount marker not found')
    text = text.replace(needle, replacement, 1)

main.write_text(text)

css = Path('src/daily-pages.css')
styles = css.read_text()
marker = '/* Dark mode: Central do Dia + Autopilot 2.0 */'
if marker not in styles:
    styles += '''\n\n/* Dark mode: Central do Dia + Autopilot 2.0 */
html[data-theme="dark"] .daily-hero,
html[data-theme="dark"] .autopilot-page-hero {
  background: linear-gradient(135deg,#15181e,#101319);
  border-color:#2a3039;
  box-shadow:none;
}
html[data-theme="dark"] .daily-hero>div:first-child>span,
html[data-theme="dark"] .autopilot-page-copy>span { color:#93a0b8; }
html[data-theme="dark"] .daily-hero p,
html[data-theme="dark"] .autopilot-page-copy p { color:#9da6b2; }
html[data-theme="dark"] .daily-health {
  background:#0f1319;
  border:1px solid #2a3039;
  color:#f7f9fb;
}
html[data-theme="dark"] .daily-health span { color:#9da6b2; }
html[data-theme="dark"] .daily-priority-panel,
html[data-theme="dark"] .autopilot-preview-panel {
  background:#15181e;
  border-color:#2a3039;
}
html[data-theme="dark"] .daily-action-card,
html[data-theme="dark"] .autopilot-preview-card {
  background:#101319;
  border-color:#2a3039;
}
html[data-theme="dark"] .daily-action-card:hover,
html[data-theme="dark"] .autopilot-preview-card:hover {
  background:#171b21;
  border-color:#3a424e;
}
html[data-theme="dark"] .daily-order,
html[data-theme="dark"] .autopilot-rank {
  background:#242a33;
  color:#c7ced8;
}
html[data-theme="dark"] .daily-lead strong,
html[data-theme="dark"] .autopilot-preview-lead strong,
html[data-theme="dark"] .daily-due strong { color:#f5f7fa; }
html[data-theme="dark"] .daily-lead span,
html[data-theme="dark"] .autopilot-preview-lead span,
html[data-theme="dark"] .daily-due span,
html[data-theme="dark"] .autopilot-preview-reason span { color:#929ca8; }
html[data-theme="dark"] .daily-actions button,
html[data-theme="dark"] .autopilot-preview-whatsapp {
  background:#171b21;
  border-color:#343c48;
  color:#c8ced6;
}
html[data-theme="dark"] .daily-actions button:hover,
html[data-theme="dark"] .autopilot-preview-whatsapp:hover {
  background:#242a33;
  color:#fff;
}
html[data-theme="dark"] .daily-actions .daily-whatsapp,
html[data-theme="dark"] .autopilot-preview-whatsapp {
  background:#172a22;
  border-color:#315846;
  color:#68d99f;
}
html[data-theme="dark"] .autopilot-page-icon,
html[data-theme="dark"] .autopilot-page-start {
  background:#f5f7f9;
  color:#18202a;
}
html[data-theme="dark"] .autopilot-page-start:hover { background:#e6eaee; }
html[data-theme="dark"] .autopilot-priority.high { background:#351b1c; color:#ffaaa3; }
html[data-theme="dark"] .autopilot-priority.medium { background:#342a16; color:#f7c56e; }
html[data-theme="dark"] .autopilot-priority.normal { background:#17263b; color:#8bc5ff; }
'''
    css.write_text(styles)
