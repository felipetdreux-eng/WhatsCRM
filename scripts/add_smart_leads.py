from pathlib import Path

jsx_path = Path('src/LeadsPage.jsx')
css_path = Path('src/leads-integrated.css')
jsx = jsx_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

replacements = [
("  Search,\n  Snowflake,\n  Target,", "  Search,\n  Snowflake,\n  Sparkles,\n  Target,"),
("import { buildCoolingWatchlist, getLeadTemperature } from './leadTemperature';\nimport './leads.css';", "import { buildCoolingWatchlist, getLeadTemperature } from './leadTemperature';\nimport { buildSmartLeadList, getLeadIntelligence } from './leadIntelligence';\nimport './leads.css';"),
("const SCOPES = ['Todos', 'Hoje', 'Atrasados', 'Próx. 7 dias', 'Sem próximo contato', 'Esfriando'];", "const SCOPES = ['Todos', 'Inteligentes', 'Hoje', 'Atrasados', 'Próx. 7 dias', 'Sem próximo contato', 'Esfriando'];"),
("function inScope(lead, scope) {\n  if (scope === 'Todos') return true;", "function SmartBadge({ lead }) {\n  const intelligence = getLeadIntelligence(lead);\n  if (!intelligence) return null;\n  const title = `${intelligence.label} · ${intelligence.score}/100 · ${intelligence.reasons.join(' · ')} · Próxima ação: ${intelligence.recommendedAction}`;\n  return <span className={`lead-smart-mini ${intelligence.level}`} title={title}><Sparkles size={11} /> {intelligence.score} · {intelligence.label}</span>;\n}\n\nfunction inScope(lead, scope) {\n  if (scope === 'Todos') return true;\n  if (scope === 'Inteligentes') return Boolean(getLeadIntelligence(lead));"),
("      cooling: buildCoolingWatchlist(active, { limit: Math.max(1, active.length) }),\n    };", "      cooling: buildCoolingWatchlist(active, { limit: Math.max(1, active.length) }),\n      smart: buildSmartLeadList(active, { limit: Math.max(1, active.length), minScore: 60 }),\n    };"),
("      .filter(lead => inScope(lead, scope))\n      .sort((a, b) => {\n        if (scope === 'Esfriando') {", "      .filter(lead => inScope(lead, scope))\n      .sort((a, b) => {\n        if (scope === 'Inteligentes') {\n          const aSmart = getLeadIntelligence(a);\n          const bSmart = getLeadIntelligence(b);\n          if ((aSmart?.score || 0) !== (bSmart?.score || 0)) return (bSmart?.score || 0) - (aSmart?.score || 0);\n          return Number(b.value || 0) - Number(a.value || 0);\n        }\n        if (scope === 'Esfriando') {"),
("        <div><span className=\"leads-kicker\"><UsersRound size={14} /> Base de clientes</span><h1>Leads</h1><p>Todos os contatos em um só lugar, com follow-ups integrados.</p></div>", "        <div><span className=\"leads-kicker\"><UsersRound size={14} /> Base de clientes</span><h1>Leads inteligentes</h1><p>Prioridade automática para você atacar primeiro quem tem mais chance e mais valor.</p></div>"),
("      <section className=\"leads-summary\">\n        <button type=\"button\" className={`critical", "      <section className=\"leads-summary\">\n        <button type=\"button\" className={`smart ${scope === 'Inteligentes' ? 'active' : ''}`} onClick={() => setScope(scope === 'Inteligentes' ? 'Todos' : 'Inteligentes')}><Sparkles size={18} /><span>Prioridade alta<strong>{summary.smart.length}</strong></span></button>\n        <button type=\"button\" className={`critical"),
("            <thead><tr><th>Lead</th><th>Status</th><th>Origem</th><th>Valor</th><th>Próximo contato</th><th>Próxima ação</th><th>Ações</th></tr></thead>", "            <thead><tr><th>Lead</th><th>Status</th><th>Origem</th><th>Valor</th><th>Inteligência</th><th>Próximo contato</th><th>Próxima ação</th><th>Ações</th></tr></thead>"),
("                <td><strong className=\"leads-value\">{money(lead.status === 'Fechado' ? lead.saleValue : lead.value)}</strong></td>\n                <td><span className={`leads-next", "                <td><strong className=\"leads-value\">{money(lead.status === 'Fechado' ? lead.saleValue : lead.value)}</strong></td>\n                <td><SmartBadge lead={lead} /></td>\n                <td><span className={`leads-next"),
("<div className=\"lead-mobile-badges\"><span className={`leads-status status-${statusClass(lead.status)}`}>{lead.status}</span><TemperatureBadge lead={lead} /></div>", "<div className=\"lead-mobile-badges\"><span className={`leads-status status-${statusClass(lead.status)}`}>{lead.status}</span><TemperatureBadge lead={lead} /><SmartBadge lead={lead} /></div>"),
]

for old, new in replacements:
    if old not in jsx:
        raise SystemExit(f'Expected JSX fragment not found: {old[:120]}')
    jsx = jsx.replace(old, new, 1)

css = css.replace(
    ".leads-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:14px}",
    ".leads-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-bottom:14px}",
    1,
)
css = css.replace(
    ".leads-summary button.critical svg{color:#d92d20}",
    ".leads-summary button.smart svg{color:#7c3aed}.leads-summary button.critical svg{color:#d92d20}",
    1,
)
css += "\n.lead-smart-mini{display:inline-flex!important;align-items:center!important;gap:4px!important;width:max-content;padding:4px 7px;border-radius:999px;font-size:8.4px!important;font-weight:800!important;line-height:1!important;margin-top:4px!important;white-space:nowrap}.lead-smart-mini.now{background:#f0e8ff;color:#6d28d9}.lead-smart-mini.high{background:#fff0df;color:#b45309}.lead-smart-mini.medium{background:#eaf3ff;color:#2563a8}.lead-smart-mini.low{background:#f1f3f5;color:#667085}.lead-mobile-badges{display:flex;align-items:flex-end;gap:5px;flex-direction:column}.leads-table{min-width:1120px}\nhtml[data-theme=\"dark\"] .lead-smart-mini.now{background:#30204d;color:#d8b4fe}html[data-theme=\"dark\"] .lead-smart-mini.high{background:#3a2b16;color:#fdba74}html[data-theme=\"dark\"] .lead-smart-mini.medium{background:#192c45;color:#93c5fd}html[data-theme=\"dark\"] .lead-smart-mini.low{background:#252a32;color:#c4cad4}\n@media(max-width:1100px){.leads-summary{grid-template-columns:repeat(3,1fr)}}\n"

jsx_path.write_text(jsx, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('Smart leads UI added.')
