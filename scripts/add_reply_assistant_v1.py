from pathlib import Path

path = Path('src/App.jsx')
s = path.read_text(encoding='utf-8')

old_import = "import GlobalQuickActions from './GlobalQuickActions';"
new_import = "import GlobalQuickActions from './GlobalQuickActions';\nimport LeadReplyAssistant from './LeadReplyAssistant';"
if new_import not in s:
    if old_import not in s:
        raise SystemExit('GlobalQuickActions import not found')
    s = s.replace(old_import, new_import, 1)

needle = """              <section className=\"detail-card\">\n                <div className=\"section-heading\"><div><h2>Observações</h2><p>Contexto importante da conversa.</p></div></div>\n                <div className=\"notes-box\">{selectedLead.notes || 'Nenhuma observação adicionada ainda.'}</div>\n              </section>\n\n              <LeadHistory userId={account?.id} leadId={selectedLead.id} />"""
replacement = """              <section className=\"detail-card\">\n                <div className=\"section-heading\"><div><h2>Observações</h2><p>Contexto importante da conversa.</p></div></div>\n                <div className=\"notes-box\">{selectedLead.notes || 'Nenhuma observação adicionada ainda.'}</div>\n              </section>\n\n              <LeadReplyAssistant lead={selectedLead} openWhatsApp={openWhatsApp} />\n\n              <LeadHistory userId={account?.id} leadId={selectedLead.id} />"""
if '<LeadReplyAssistant lead={selectedLead}' not in s:
    if needle not in s:
        raise SystemExit('Lead detail insertion point not found')
    s = s.replace(needle, replacement, 1)

path.write_text(s, encoding='utf-8')
print('reply assistant V1 wired into lead detail')
