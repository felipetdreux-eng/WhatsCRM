from pathlib import Path

p = Path('src/LeadsPage.jsx')
text = p.read_text()

helper_anchor = "const statusClass = status => status.toLowerCase().replaceAll(' ', '-');\n"
helper = """const markSelectValue = lead => {
  if (!lead?.nextContact) return '';
  const days = diff(lead.nextContact);
  if ([0, 1, 3, 7].includes(days)) return String(days);
  return 'scheduled';
};
"""
if 'const markSelectValue = lead =>' not in text:
    if helper_anchor not in text:
        raise SystemExit('mark helper anchor not found')
    text = text.replace(helper_anchor, helper_anchor + helper, 1)

text = text.replace("    event.target.value = '';\n", '', 1)

old_select = 'className="lead-mark-for" defaultValue="" onChange={event => handleMarkFor(event, lead)}'
new_select = 'className="lead-mark-for" value={markSelectValue(lead)} onChange={event => handleMarkFor(event, lead)}'
if old_select not in text:
    raise SystemExit('desktop mark select anchor not found')
text = text.replace(old_select, new_select, 1)

old_mobile = 'className="lead-mark-for mobile-mark-for" defaultValue="" onChange={event => handleMarkFor(event, lead)}'
new_mobile = 'className="lead-mark-for mobile-mark-for" value={markSelectValue(lead)} onChange={event => handleMarkFor(event, lead)}'
if old_mobile not in text:
    raise SystemExit('mobile mark select anchor not found')
text = text.replace(old_mobile, new_mobile, 1)

placeholder = '<option value="" disabled>Marcar para</option>'
replacement = '<option value="" disabled>Marcar para</option>\n                    <option value="scheduled" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcado\'}</option>'
if text.count(placeholder) < 2:
    raise SystemExit('mark option placeholders not found')
text = text.replace(placeholder, replacement, 1)

mobile_replacement = '<option value="" disabled>Marcar para</option>\n                <option value="scheduled" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcado\'}</option>'
text = text.replace(placeholder, mobile_replacement, 1)

p.write_text(text)
