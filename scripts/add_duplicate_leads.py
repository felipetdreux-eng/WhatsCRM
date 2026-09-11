from pathlib import Path

jsx_path = Path('src/LeadsPage.jsx')
css_path = Path('src/leads-integrated.css')
jsx = jsx_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

replacements = [
("  Clock3,\n  FileSpreadsheet,", "  Clock3,\n  Copy,\n  FileSpreadsheet,"),
("import { buildSmartLeadList, getLeadIntelligence } from './leadIntelligence';\nimport './leads.css';", "import { buildSmartLeadList, getLeadIntelligence } from './leadIntelligence';\nimport { buildDuplicateIndex, duplicateGroupCount } from './duplicateLeads';\nimport './leads.css';"),
("const SCOPES = ['Todos', 'Inteligentes', 'Hoje', 'Atrasados', 'Próx. 7 dias', 'Sem próximo contato', 'Esfriando'];", "const SCOPES = ['Todos', 'Inteligentes', 'Duplicados', 'Hoje', 'Atrasados', 'Próx. 7 dias', 'Sem próximo contato', 'Esfriando'];"),
("function inScope(lead, scope) {\n  if (scope === 'Todos') return true;\n  if (scope === 'Inteligentes') return Boolean(getLeadIntelligence(lead));", "function DuplicateBadge({ lead, duplicateIndex }) {\n  const duplicate = duplicateIndex.get(lead.id);\n  if (!duplicate) return null;\n  const top = duplicate.matches[0];\n  const extra = duplicate.matches.length > 1 ? ` +${duplicate.matches.length - 1}` : '';\n  const title = duplicate.matches.map(match => `${match.name}: ${match.reason} (${match.confidence}%)`).join(' · ');\n  return <span className=\"lead-duplicate-mini\" title={title}><Copy size={11} /> Possível duplicado: {top?.name || 'outro lead'}{extra}</span>;\n}\n\nfunction inScope(lead, scope, duplicateIndex) {\n  if (scope === 'Todos') return true;\n  if (scope === 'Inteligentes') return Boolean(getLeadIntelligence(lead));\n  if (scope === 'Duplicados') return duplicateIndex.has(lead.id);"),
("  const [importOpen, setImportOpen] = useState(false);\n\n  const summary = useMemo(() => {", "  const [importOpen, setImportOpen] = useState(false);\n  const duplicateIndex = useMemo(() => buildDuplicateIndex(leads), [leads]);\n  const duplicateGroups = useMemo(() => duplicateGroupCount(duplicateIndex), [duplicateIndex]);\n\n  const summary = useMemo(() => {"),
("      .filter(lead => inScope(lead, scope))\n      .sort((a, b) => {\n        if (scope === 'Inteligentes') {", "      .filter(lead => inScope(lead, scope, duplicateIndex))\n      .sort((a, b) => {\n        if (scope === 'Duplicados') {\n          const aDuplicate = duplicateIndex.get(a.id);\n          const bDuplicate = duplicateIndex.get(b.id);\n          return (bDuplicate?.highestConfidence || 0) - (aDuplicate?.highestConfidence || 0);\n        }\n        if (scope === 'Inteligentes') {"),
("  }, [leads, query, status, scope]);", "  }, [leads, query, status, scope, duplicateIndex]);"),
("        <button type=\"button\" className={`smart ${scope === 'Inteligentes' ? 'active' : ''}`} onClick={() => setScope(scope === 'Inteligentes' ? 'Todos' : 'Inteligentes')}><Sparkles size={18} /><span>Prioridade alta<strong>{summary.smart.length}</strong></span></button>\n        <button type=\"button\" className={`critical", "        <button type=\"button\" className={`smart ${scope === 'Inteligentes' ? 'active' : ''}`} onClick={() => setScope(scope === 'Inteligentes' ? 'Todos' : 'Inteligentes')}><Sparkles size={18} /><span>Prioridade alta<strong>{summary.smart.length}</strong></span></button>\n        <button type=\"button\" className={`duplicate ${scope === 'Duplicados' ? 'active' : ''}`} onClick={() => setScope(scope === 'Duplicados' ? 'Todos' : 'Duplicados')}><Copy size={18} /><span>Grupos duplicados<strong>{duplicateGroups}</strong></span></button>\n        <button type=\"button\" className={`critical"),
("<div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span><TemperatureBadge lead={lead} /></div>", "<div><strong>{lead.name}</strong><span>{lead.company || 'Sem empresa'}</span><TemperatureBadge lead={lead} /><DuplicateBadge lead={lead} duplicateIndex={duplicateIndex} /></div>"),
("<div className=\"lead-mobile-badges\"><span className={`leads-status status-${statusClass(lead.status)}`}>{lead.status}</span><TemperatureBadge lead={lead} /><SmartBadge lead={lead} /></div>", "<div className=\"lead-mobile-badges\"><span className={`leads-status status-${statusClass(lead.status)}`}>{lead.status}</span><TemperatureBadge lead={lead} /><SmartBadge lead={lead} /><DuplicateBadge lead={lead} duplicateIndex={duplicateIndex} /></div>"),
]

for old, new in replacements:
    if old not in jsx:
        raise SystemExit(f'Expected JSX fragment not found: {old[:140]}')
    jsx = jsx.replace(old, new, 1)

css = css.replace(
    ".leads-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-bottom:14px}",
    ".leads-summary{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;margin-bottom:14px}",
    1,
)
css = css.replace(
    ".leads-summary button.smart svg{color:#7c3aed}.leads-summary button.critical svg{color:#d92d20}",
    ".leads-summary button.smart svg{color:#7c3aed}.leads-summary button.duplicate svg{color:#d97706}.leads-summary button.critical svg{color:#d92d20}",
    1,
)
css += "\n.lead-duplicate-mini{display:inline-flex!important;align-items:center!important;gap:4px!important;width:max-content;max-width:210px;padding:4px 7px;border-radius:999px;background:#fff4e5;color:#b45309;font-size:8.2px!important;font-weight:800!important;line-height:1!important;margin-top:4px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lead-duplicate-mini svg{flex:0 0 auto}html[data-theme=\"dark\"] .lead-duplicate-mini{background:#3b2a16;color:#fdba74}\n"

jsx_path.write_text(jsx, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('Duplicate lead detection UI added.')
