from pathlib import Path

app_path = Path('src/App.jsx')
dash_path = Path('src/Dashboard.jsx')
app = app_path.read_text(encoding='utf-8')
dash = dash_path.read_text(encoding='utf-8')

app = app.replace("  const [pendingSale, setPendingSale] = useState(null);\n  const [saleError, setSaleError] = useState('');", "  const [pendingSale, setPendingSale] = useState(null);\n  const [saleError, setSaleError] = useState('');\n  const [pendingLoss, setPendingLoss] = useState(null);\n  const [lossReason, setLossReason] = useState('');", 1)

app = app.replace("  const commitStatusChange = (id, status, saleValue) => {\n    const previous = leads.find(lead => lead.id === id);\n    if (!previous || previous.status === status) return;\n    const next = applyStatusTransition(previous, {}, status, saleValue);", "  const commitStatusChange = (id, status, saleValue, draft = {}) => {\n    const previous = leads.find(lead => lead.id === id);\n    if (!previous || previous.status === status) return;\n    const next = applyStatusTransition(previous, draft, status, saleValue);", 1)

old = """    if (status === 'Fechado') {\n      setSaleError('');\n      setPendingSale({ id, name: lead.name, value: lead.saleValue ?? lead.value ?? '' });\n      return;\n    }\n    commitStatusChange(id, status);"""
new = """    if (status === 'Fechado') {\n      setSaleError('');\n      setPendingSale({ id, name: lead.name, value: lead.saleValue ?? lead.value ?? '' });\n      return;\n    }\n    if (status === 'Perdido') {\n      setLossReason('');\n      setPendingLoss({ id, name: lead.name });\n      return;\n    }\n    commitStatusChange(id, status);"""
if old not in app:
    raise SystemExit('requestStatusChange fragment not found')
app = app.replace(old, new, 1)

needle = """  const confirmSale = event => {\n    event.preventDefault();\n    if (!pendingSale) return;\n    const value = Number(pendingSale.value);\n    if (!Number.isFinite(value) || value <= 0) {\n      setSaleError('Informe o valor final da venda, maior que zero.');\n      return;\n    }\n    commitStatusChange(pendingSale.id, 'Fechado', value);\n    setPendingSale(null);\n    setSaleError('');\n  };"""
replacement = needle + """\n\n  const confirmLoss = event => {\n    event.preventDefault();\n    if (!pendingLoss) return;\n    const reason = lossReason.trim();\n    if (!reason) return;\n    const lead = leads.find(item => item.id === pendingLoss.id);\n    if (!lead) { setPendingLoss(null); return; }\n    const cleanNotes = String(lead.notes || '').replace(/(?:^|\\n)Motivo da perda:.*(?:\\n|$)/gi, '\\n').trim();\n    const notes = [`Motivo da perda: ${reason}`, cleanNotes].filter(Boolean).join('\\n\\n');\n    commitStatusChange(pendingLoss.id, 'Perdido', undefined, { notes });\n    logActivity(lead, 'lead_lost', 'Lead marcado como perdido', `Motivo: ${reason}.`, { reason });\n    setPendingLoss(null);\n    setLossReason('');\n  };"""
if needle not in app:
    raise SystemExit('confirmSale fragment not found')
app = app.replace(needle, replacement, 1)

modal_anchor = """      {pendingSale && (\n        <div className=\"modal-backdrop\" onMouseDown={() => { setPendingSale(null); setSaleError(''); }}>"""
idx = app.find(modal_anchor)
if idx == -1:
    raise SystemExit('pendingSale modal not found')
# insert loss modal after full pendingSale block by finding the next closing sequence before app root closes
start = idx
end_seq = "      )}\n    </div>\n  );"
end = app.find(end_seq, start)
if end == -1:
    raise SystemExit('app closing after sale modal not found')
loss_modal = """\n\n      {pendingLoss && (\n        <div className=\"modal-backdrop\" onMouseDown={() => { setPendingLoss(null); setLossReason(''); }}>\n          <section className=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"loss-modal-title\" onMouseDown={e => e.stopPropagation()}>\n            <div className=\"modal-header\"><div><h2 id=\"loss-modal-title\">Por que essa venda foi perdida?</h2><p>{pendingLoss.name} · isso ajuda o Fuply a mostrar onde seu processo está falhando.</p></div><button type=\"button\" className=\"icon-button\" onClick={() => { setPendingLoss(null); setLossReason(''); }} aria-label=\"Fechar\"><X size={20} /></button></div>\n            <form className=\"lead-form\" onSubmit={confirmLoss}>\n              <label className=\"full\"><span>Motivo *</span><select autoFocus required value={lossReason} onChange={e => setLossReason(e.target.value)}><option value=\"\" disabled>Selecione um motivo</option><option>Preço</option><option>Sem resposta</option><option>Escolheu concorrente</option><option>Sem orçamento agora</option><option>Prazo</option><option>Não tinha interesse real</option><option>Outro</option></select></label>\n              <div className=\"modal-actions full\"><button type=\"button\" className=\"secondary-button\" onClick={() => { setPendingLoss(null); setLossReason(''); }}>Cancelar</button><button className=\"primary-button lost-action\"><XCircle size={16} /> Confirmar perda</button></div>\n            </form>\n          </section>\n        </div>\n      )}"""
app = app[:end] + loss_modal + app[end:]

# Dashboard: add helper to parse stored reason
helper_anchor = """function statusClass(status = '') {\n  return status.toLowerCase().replaceAll(' ', '-');\n}"""
helper = helper_anchor + """\n\nfunction lostReason(lead) {\n  const match = String(lead?.notes || '').match(/Motivo da perda:\\s*([^\\n]+)/i);\n  return match?.[1]?.trim() || 'Sem motivo informado';\n}"""
if helper_anchor not in dash:
    raise SystemExit('dashboard helper anchor missing')
dash = dash.replace(helper_anchor, helper, 1)

needle = """    const teamMap = new Map();"""
insert = """    const lossReasonMap = new Map();\n    lost.forEach(lead => {\n      const reason = lostReason(lead);\n      lossReasonMap.set(reason, (lossReasonMap.get(reason) || 0) + 1);\n    });\n    const lossReasons = [...lossReasonMap.entries()]\n      .map(([reason, count]) => ({ reason, count }))\n      .sort((a, b) => b.count - a.count);\n\n    const teamMap = new Map();"""
if needle not in dash:
    raise SystemExit('teamMap anchor missing')
dash = dash.replace(needle, insert, 1)

dash = dash.replace("      bottleneck,\n      team,", "      bottleneck,\n      lossReasons,\n      team,", 1)

old_block = """            <button type=\"button\" onClick={() => goLeads({ status: 'Perdido' })}><div><strong>Leads perdidos</strong><span>revise padrões de perda</span></div><b>{data.lost.length}</b></button>"""
new_block = """            <button type=\"button\" onClick={() => goLeads({ status: 'Perdido' })}><div><strong>Leads perdidos</strong><span>{data.lossReasons[0] ? `Principal motivo: ${data.lossReasons[0].reason}` : 'revise padrões de perda'}</span></div><b>{data.lost.length}</b></button>"""
if old_block not in dash:
    raise SystemExit('lost summary block missing')
dash = dash.replace(old_block, new_block, 1)

anchor = """      {data.team.length > 1 && ("""
loss_section = """      {data.lossReasons.length > 0 && (\n        <section className=\"dashboard-panel\" style={{ marginTop: 14 }}>\n          <div className=\"dashboard-panel-head\"><div><h2>Por que as vendas estão sendo perdidas?</h2><p>Motivos registrados quando um lead é marcado como perdido.</p></div><button type=\"button\" onClick={() => goLeads({ status: 'Perdido' })}>Ver perdidos <ArrowRight size={14} /></button></div>\n          <div className=\"results-list\">\n            {data.lossReasons.slice(0, 5).map(item => <button type=\"button\" key={item.reason} onClick={() => goLeads({ status: 'Perdido' })}><div><strong>{item.reason}</strong><span>{item.count} lead{item.count === 1 ? '' : 's'} perdido{item.count === 1 ? '' : 's'}</span></div><b>{item.count}</b></button>)}\n          </div>\n        </section>\n      )}\n\n""" + anchor
if anchor not in dash:
    raise SystemExit('team section anchor missing')
dash = dash.replace(anchor, loss_section, 1)

app_path.write_text(app, encoding='utf-8')
dash_path.write_text(dash, encoding='utf-8')
print('Loss reasons added.')
