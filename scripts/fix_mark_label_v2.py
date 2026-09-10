from pathlib import Path
import re

p = Path('src/LeadsPage.jsx')
text = p.read_text()

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

# Remove every stale internal scheduled option, including duplicates from older patches.
text = re.sub(r'\s*<option value="scheduled" disabled>\{lead\.nextContact \? `Marcado: \$\{pretty\(lead\.nextContact\)\}` : \'Marcado\'\}</option>', '', text)

# Make the visible placeholder itself show the saved mark.
text = text.replace(
    '<option value="" disabled>Marcar para</option>',
    '<option value="" disabled>{lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : \'Marcar para\'}</option>',
)

if 'markSelectValue' in text:
    raise SystemExit('markSelectValue still present')
if 'value="scheduled"' in text:
    raise SystemExit('scheduled option still present')
if text.count("lead.nextContact ? `Marcado: ${pretty(lead.nextContact)}` : 'Marcar para'") != 2:
    raise SystemExit('expected exactly two dynamic mark labels')

p.write_text(text)
