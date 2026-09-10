from pathlib import Path

p = Path('src/LeadsPage.jsx')
text = p.read_text()

# Remove the controlled select helper. The select will always display a dynamic
# placeholder based on nextContact, avoiding browser quirks with selected disabled options.
helper = """const markSelectValue = lead => {
  if (!lead?.nextContact) return '';
  const days = diff(lead.nextContact);
  if ([0, 1, 3, 7].includes(days)) return String(days);
  return 'scheduled';
};
"""
text = text.replace(helper, '')

text = text.replace(
    'className="lead-mark-for" value={markSelectValue(lead)} onChange={event => handleMarkFor(event, lead)}',
    'className="lead-mark-for" value="" onChange={event => handleMarkFor(event, lead)}',
)
text = text.replace(
    'className="lead-mark-for mobile-mark-for" value={markSelectValue(lead)} onChange={event => handleMarkFor(event, lead)}',
    'className="lead-mark-for mobile-mark-for" value="" onChange={event => handleMarkFor(event, lead)}',
)

# Replace placeholder + scheduled option in desktop and mobile with one dynamic label.
text = text.replace(
    '<option value="" disabled>Marcar para</option>\n                    <option value="scheduled" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcado\'}</option>',
    '<option value="" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcar para\'}</option>',
)
text = text.replace(
    '<option value="" disabled>Marcar para</option>\n                <option value="scheduled" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcado\'}</option>',
    '<option value="" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcar para\'}</option>',
)

if 'markSelectValue' in text:
    raise SystemExit('markSelectValue still present')
if 'value="scheduled"' in text:
    raise SystemExit('scheduled option still present')
if text.count("lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : 'Marcar para'") < 2:
    raise SystemExit('dynamic labels not installed in both selects')

p.write_text(text)
