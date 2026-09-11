from pathlib import Path

app_path = Path('src/App.jsx')
leads_path = Path('src/LeadsPage.jsx')
app = app_path.read_text(encoding='utf-8')
leads = leads_path.read_text(encoding='utf-8')

# App imports
app = app.replace("import SettingsPage from './SettingsPage';", "import SettingsPage from './SettingsPage';\nimport GlobalQuickActions from './GlobalQuickActions';", 1)
app = app.replace("import './team-leads.css';", "import './team-leads.css';\nimport './usability.css';", 1)

# Simpler navigation
old_nav = """const NAV_ITEMS = [\n  ['Dashboard', LayoutDashboard],\n  ['Central do Dia', CalendarClock],\n  ['Autopilot 2.0', Sparkles],\n  ['Pipeline', ListFilter],\n  ['Leads', UsersRound],\n  ['Mensagens', MessagesSquare],\n  ['Configurações', Settings],\n];"""
new_nav = """const NAV_ITEMS = [\n  ['Início', CalendarClock],\n  ['Resultados', LayoutDashboard],\n  ['Pipeline', ListFilter],\n  ['Leads', UsersRound],\n  ['Mensagens', MessagesSquare],\n  ['Configurações', Settings],\n];"""
if old_nav not in app:
    raise SystemExit('NAV_ITEMS fragment not found')
app = app.replace(old_nav, new_nav, 1)

app = app.replace("const [activePage, setActivePage] = useState('Dashboard');", "const [activePage, setActivePage] = useState('Início');", 1)
app = app.replace("  const [formError, setFormError] = useState('');", "  const [formError, setFormError] = useState('');\n  const [leadsPreset, setLeadsPreset] = useState(null);\n  const [undoAction, setUndoAction] = useState(null);", 1)

# Undo expiration
needle = """  useEffect(() => {\n    localStorage.setItem('zapflow-leads', JSON.stringify(leads));\n  }, [leads]);"""
replacement = needle + """\n\n  useEffect(() => {\n    if (!undoAction) return undefined;\n    const timer = window.setTimeout(() => setUndoAction(null), 7000);\n    return () => window.clearTimeout(timer);\n  }, [undoAction]);"""
if needle not in app:
    raise SystemExit('localStorage effect not found')
app = app.replace(needle, replacement, 1)

# Undo status transitions
needle = """  const commitStatusChange = (id, status, saleValue) => {\n    const previous = leads.find(lead => lead.id === id);\n    if (!previous || previous.status === status) return;\n    const next = applyStatusTransition(previous, {}, status, saleValue);\n    setLeads(current => current.map(lead => lead.id === id ? next : lead));"""
replacement = """  const commitStatusChange = (id, status, saleValue) => {\n    const previous = leads.find(lead => lead.id === id);\n    if (!previous || previous.status === status) return;\n    const next = applyStatusTransition(previous, {}, status, saleValue);\n    setUndoAction({ id: Date.now(), message: `${previous.name}: ${previous.status} → ${status}`, lead: previous });\n    setLeads(current => current.map(lead => lead.id === id ? next : lead));"""
if needle not in app:
    raise SystemExit('commitStatusChange fragment not found')
app = app.replace(needle, replacement, 1)

# Navigation helpers
needle = """  const navigate = label => {\n    setActivePage(label);\n    setSelectedLeadId(null);\n    setEditingLead(null);\n    setFormError('');\n  };"""
replacement = """  const navigate = label => {\n    setActivePage(label);\n    setSelectedLeadId(null);\n    setEditingLead(null);\n    setFormError('');\n    if (label !== 'Leads') setLeadsPreset(null);\n  };\n\n  const openLeadsView = (preset = {}) => {\n    setLeadsPreset({ ...preset, nonce: Date.now() });\n    setActivePage('Leads');\n    setSelectedLeadId(null);\n    setEditingLead(null);\n    setFormError('');\n  };\n\n  const openPipelineView = (status = 'Todos') => {\n    setStatusFilter(status || 'Todos');\n    setOriginFilter('Todas');\n    setAssigneeFilter('Todos');\n    setActivePage('Pipeline');\n    setSelectedLeadId(null);\n    setEditingLead(null);\n    setFormError('');\n  };\n\n  const restoreUndo = () => {\n    if (!undoAction?.lead) return;\n    const previous = undoAction.lead;\n    setLeads(current => current.map(lead => lead.id === previous.id ? previous : lead));\n    setUndoAction(null);\n  };"""
if needle not in app:
    raise SystemExit('navigate fragment not found')
app = app.replace(needle, replacement, 1)

app = app.replace("onClick={() => navigate('Dashboard')} aria-label=\"Ir para Dashboard\"", "onClick={() => navigate('Início')} aria-label=\"Ir para Início\"", 1)

# Active page routing
old_router = """    if (activePage === 'Dashboard') return <Dashboard leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} />;\n    if (activePage === 'Central do Dia') return <CentralDoDia leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} />;\n    if (activePage === 'Autopilot 2.0') return <AutopilotPage leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onAutopilotOutcome={applyAutopilotOutcome} />;\n    if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} />;"""
new_router = """    if (activePage === 'Resultados') return <Dashboard leads={leads} goPipeline={openPipelineView} goLeads={openLeadsView} memberName={memberName} />;\n    if (activePage === 'Início') return <CentralDoDia leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => openPipelineView()} goFollowUps={openLeadsView} goAutopilot={() => setActivePage('Autopilot 2.0')} />;\n    if (activePage === 'Autopilot 2.0') return <AutopilotPage leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onAutopilotOutcome={applyAutopilotOutcome} />;\n    if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} preset={leadsPreset} />;"""
if old_router not in app:
    raise SystemExit('router fragment not found')
app = app.replace(old_router, new_router, 1)

# Inject global search/actions and undo before modal
needle = """      {renderActivePage()}\n\n      {modalOpen && ("""
replacement = """      {renderActivePage()}\n\n      <GlobalQuickActions leads={leads} onNewLead={() => openNewLead()} onNavigate={navigate} onOpenLead={openLead} onOpenLeads={openLeadsView} />\n      {undoAction && <div className=\"undo-toast\" role=\"status\"><span>{undoAction.message}</span><button type=\"button\" onClick={restoreUndo}>Desfazer</button></div>}\n\n      {modalOpen && ("""
if needle not in app:
    raise SystemExit('renderActivePage injection fragment not found')
app = app.replace(needle, replacement, 1)

# Replace giant new-lead form with progressive disclosure
start = app.index('            <form onSubmit={addLead} className="lead-form">', app.index('{modalOpen &&'))
end_marker = '            </form>\n          </section>\n        </div>\n      )}'
end = app.index(end_marker, start)
old_form = app[start:end + len('            </form>')]
new_form = '''            <form onSubmit={addLead} className="quick-lead-form">\n              <label><span>Nome *</span><input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: João Silva" /></label>\n              <label><span>WhatsApp *</span><input required inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="21999999999" /></label>\n              <details className="quick-lead-details">\n                <summary>Mais detalhes (opcional)</summary>\n                <div className="quick-lead-details-grid">\n                  <label><span>Empresa</span><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Ex.: Sua Obra Engenharia" /></label>\n                  <label><span>Valor potencial</span><input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="10000" /></label>\n                  <label><span>Status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{OPEN_STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></label>\n                  <label><span>Origem</span><select value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></label>\n                  <label><span>Responsável</span><select value={form.assignedTo || account?.id || ''} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>{teamMembers.length ? teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.name}{member.user_id === account?.id ? ' (você)' : ''}</option>) : <option value={account?.id || ''}>{accountName}</option>}</select></label>\n                  <label><span>Próximo contato</span><input type="date" min={localDateKey()} value={form.nextContact} onChange={e => setForm({ ...form, nextContact: e.target.value })} /></label>\n                  <label><span>Horário</span><input type="time" value={form.nextContactTime} onChange={e => setForm({ ...form, nextContactTime: e.target.value })} /></label>\n                  <label><span>Próxima ação</span><input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" /></label>\n                  <label className="full"><span>Observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Contexto da conversa..." /></label>\n                </div>\n              </details>\n              {formError && <div className="auth-error full" role="alert">{formError}</div>}\n              <div className="modal-actions full"><button type="button" className="secondary-button" onClick={() => { setModalOpen(false); setFormError(''); }}>Cancelar</button><button className="primary-button"><Plus size={16} /> Adicionar lead</button></div>\n            </form>'''
app = app[:start] + new_form + app[end + len('            </form>'):]

# LeadsPage imports/useEffect
leads = leads.replace("import React, { useMemo, useState } from 'react';", "import React, { useEffect, useMemo, useState } from 'react';", 1)
leads = leads.replace("export default function LeadsPage({ leads, setLeads, openLead, openWhatsApp, onNewLead, updateLeadStatus, onActivity }) {", "export default function LeadsPage({ leads, setLeads, openLead, openWhatsApp, onNewLead, updateLeadStatus, onActivity, preset }) {", 1)
leads = leads.replace("  const [importOpen, setImportOpen] = useState(false);", "  const [importOpen, setImportOpen] = useState(false);\n  const [viewMode, setViewMode] = useState(() => localStorage.getItem('fuply-leads-view') || 'simple');", 1)

# preset effect after duplicate useMemos
needle = """  const duplicateIndex = useMemo(() => buildDuplicateIndex(leads), [leads]);\n  const duplicateGroups = useMemo(() => duplicateGroupCount(duplicateIndex), [duplicateIndex]);"""
replacement = needle + """\n\n  useEffect(() => {\n    if (!preset) return;\n    setQuery('');\n    setStatus(preset.status || 'Todos');\n    setScope(preset.scope || 'Todos');\n  }, [preset?.nonce]);\n\n  const changeViewMode = mode => {\n    setViewMode(mode);\n    localStorage.setItem('fuply-leads-view', mode);\n  };"""
if needle not in leads:
    raise SystemExit('duplicate memo block not found')
leads = leads.replace(needle, replacement, 1)

# preset origin/assignee filters
needle = """      .filter(lead => status === 'Todos' || lead.status === status)\n      .filter(lead => inScope(lead, scope, duplicateIndex))"""
replacement = """      .filter(lead => status === 'Todos' || lead.status === status)\n      .filter(lead => !preset?.origin || lead.origin === preset.origin)\n      .filter(lead => !preset?.assignee || lead.assignedTo === preset.assignee)\n      .filter(lead => inScope(lead, scope, duplicateIndex))"""
if needle not in leads:
    raise SystemExit('filter chain not found')
leads = leads.replace(needle, replacement, 1)
leads = leads.replace("  }, [leads, query, status, scope, duplicateIndex]);", "  }, [leads, query, status, scope, duplicateIndex, preset?.origin, preset?.assignee]);", 1)

# Inline editing helpers before return
needle = """  const importDone = stats => {\n    const pieces = [];\n    if (stats.create) pieces.push(`${stats.create} novo${stats.create === 1 ? '' : 's'}`);\n    if (stats.update) pieces.push(`${stats.update} atualizado${stats.update === 1 ? '' : 's'}`);\n    if (stats.errors) pieces.push(`${stats.errors} linha${stats.errors === 1 ? '' : 's'} ignorada${stats.errors === 1 ? '' : 's'}`);\n    flash(`Importação concluída: ${pieces.join(', ') || 'nenhuma alteração'}.`);\n  };"""
replacement = needle + """\n\n  const updateInlineValue = (lead, rawValue) => {\n    const value = Math.max(0, Number(rawValue || 0));\n    if (!Number.isFinite(value) || value === Number(lead.value || 0)) return;\n    const now = new Date().toISOString();\n    setLeads(current => current.map(item => item.id === lead.id ? { ...item, value, updatedAt: now } : item));\n    onActivity?.(lead, 'lead_updated', 'Valor potencial atualizado', `${money(lead.value)} → ${money(value)}.`, { from: Number(lead.value || 0), to: value });\n    flash(`${lead.name}: valor potencial atualizado.`);\n  };\n\n  const updateInlineAction = (lead, rawAction) => {\n    const action = rawAction.trim();\n    if (action === (lead.nextAction || '')) return;\n    const now = new Date().toISOString();\n    setLeads(current => current.map(item => item.id === lead.id ? { ...item, nextAction: action, updatedAt: now } : item));\n    onActivity?.(lead, 'lead_updated', 'Próxima ação atualizada', action || 'Próxima ação removida.');\n    flash(`${lead.name}: próxima ação atualizada.`);\n  };"""
if needle not in leads:
    raise SystemExit('importDone block not found')
leads = leads.replace(needle, replacement, 1)

# Main class / header view toggle
leads = leads.replace('<main className="main-content leads-page">', '<main className={`main-content leads-page ${viewMode === \'simple\' ? \'leads-simple-mode\' : \'leads-complete-mode\'}`}>', 1)
needle = """        <div className=\"leads-header-actions\">\n          <button type=\"button\" className=\"secondary-button leads-import-button\" onClick={() => setImportOpen(true)}><FileSpreadsheet size={17} /> Importar planilha</button>\n          <button type=\"button\" className=\"primary-button\" onClick={onNewLead}><Plus size={18} /> Novo lead</button>\n        </div>"""
replacement = """        <div className=\"leads-header-actions\">\n          <div className=\"view-mode-toggle\" aria-label=\"Modo de visualização\"><button type=\"button\" className={viewMode === 'simple' ? 'active' : ''} onClick={() => changeViewMode('simple')}>Simples</button><button type=\"button\" className={viewMode === 'complete' ? 'active' : ''} onClick={() => changeViewMode('complete')}>Completo</button></div>\n          <button type=\"button\" className=\"secondary-button leads-import-button\" onClick={() => setImportOpen(true)}><FileSpreadsheet size={17} /> Importar planilha</button>\n          <button type=\"button\" className=\"primary-button\" onClick={onNewLead}><Plus size={18} /> Novo lead</button>\n        </div>"""
if needle not in leads:
    raise SystemExit('leads header actions not found')
leads = leads.replace(needle, replacement, 1)

# Inline value and action cells
old = '<td><strong className="leads-value">{money(lead.status === \'Fechado\' ? lead.saleValue : lead.value)}</strong></td>'
new = '<td onClick={event => event.stopPropagation()}>{lead.status === \'Fechado\' ? <strong className="leads-value">{money(lead.saleValue)}</strong> : <input className="inline-value-input" type="number" min="0" step="0.01" defaultValue={Number(lead.value || 0)} onBlur={event => updateInlineValue(lead, event.target.value)} aria-label={`Valor potencial de ${lead.name}`} />}</td>'
if old not in leads:
    raise SystemExit('desktop value cell not found')
leads = leads.replace(old, new, 1)
old = '<td>{lead.nextAction || \'—\'}</td>'
new = '<td onClick={event => event.stopPropagation()}><input className="inline-next-action-input" defaultValue={lead.nextAction || \'\'} placeholder="Definir ação" onBlur={event => updateInlineAction(lead, event.target.value)} aria-label={`Próxima ação de ${lead.name}`} /></td>'
if old not in leads:
    raise SystemExit('desktop next action cell not found')
leads = leads.replace(old, new, 1)

app_path.write_text(app, encoding='utf-8')
leads_path.write_text(leads, encoding='utf-8')
print('Usability overhaul applied.')
