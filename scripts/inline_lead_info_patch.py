from pathlib import Path

app = Path('src/App.jsx')
text = app.read_text()
start_marker = '        {editingLead ? (\n'
branch_end_marker = '        ) : (\n          <div className="detail-grid">'
start = text.index(start_marker)
end = text.index(branch_end_marker, start)
replacement = '''        {editingLead ? (
          <form className="detail-grid inline-detail-edit" onSubmit={saveLead}>
            <div className="detail-main-column">
              <section className="detail-card info-edit-card">
                <div className="section-heading inline-section-heading">
                  <div><h2>Informações</h2><p>Edite os dados diretamente aqui.</p></div>
                  <div className="inline-edit-actions">
                    <button type="button" className="secondary-button" onClick={() => { setEditingLead(null); setFormError(''); }}>Cancelar</button>
                    <button className="primary-button"><Save size={16} /> Salvar</button>
                  </div>
                </div>
                <div className="info-grid editable-info-grid">
                  <label className="info-item info-edit-item"><UserRound size={18} /><div><span>Nome</span><input required value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} /></div></label>
                  <label className="info-item info-edit-item"><Building2 size={18} /><div><span>Empresa</span><input value={editingLead.company || ''} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} placeholder="Não informado" /></div></label>
                  <label className="info-item info-edit-item"><Phone size={18} /><div><span>WhatsApp</span><input required inputMode="tel" value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} /></div></label>
                  <label className="info-item info-edit-item"><CircleDollarSign size={18} /><div><span>Valor potencial</span><input type="number" min="0" step="0.01" value={editingLead.value} onChange={e => setEditingLead({ ...editingLead, value: e.target.value })} /></div></label>
                  <label className="info-item info-edit-item"><Target size={18} /><div><span>Status</span><select value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value })}>{STATUSES.map(status => <option key={status.id}>{status.id}</option>)}</select></div></label>
                  {editingLead.status === 'Vendido' && <label className="info-item info-edit-item"><CheckCircle2 size={18} /><div><span>Valor vendido</span><input type="number" min="0.01" step="0.01" value={editingLead.saleValue} onChange={e => setEditingLead({ ...editingLead, saleValue: e.target.value })} /></div></label>}
                  <label className="info-item info-edit-item"><MapPin size={18} /><div><span>Origem</span><select value={editingLead.origin || 'Outro'} onChange={e => setEditingLead({ ...editingLead, origin: e.target.value })}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></div></label>
                  <label className="info-item info-edit-item"><UsersRound size={18} /><div><span>Responsável</span><select value={editingLead.assignedTo || account?.id || ''} onChange={e => setEditingLead({ ...editingLead, assignedTo: e.target.value })}>{teamMembers.length ? teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.name}{member.user_id === account?.id ? ' (você)' : ''}</option>) : <option value={account?.id || ''}>{accountName}</option>}</select></div></label>
                </div>
                {formError && <div className="auth-error inline-edit-error" role="alert">{formError}</div>}
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Observações</h2><p>Contexto importante da conversa.</p></div></div>
                <textarea className="inline-notes-editor" value={editingLead.notes || ''} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} placeholder="Adicione observações sobre este lead..." />
              </section>

              <LeadHistory userId={account?.id} leadId={selectedLead.id} />
            </div>

            <aside className="detail-side-column">
              <section className="detail-card next-action-card">
                <div className="section-heading"><div><h2>Próxima ação</h2><p>Edite o próximo passo sem sair desta tela.</p></div></div>
                <div className="inline-next-form">
                  <label><span>Data</span><input type="date" min={localDateKey()} value={editingLead.nextContact || ''} onChange={e => setEditingLead({ ...editingLead, nextContact: e.target.value })} disabled={CLOSED.includes(editingLead.status)} /></label>
                  <label><span>Horário</span><input type="time" value={editingLead.nextContactTime || ''} onChange={e => setEditingLead({ ...editingLead, nextContactTime: e.target.value })} disabled={CLOSED.includes(editingLead.status)} /></label>
                  <label className="full"><span>Ação</span><input value={editingLead.nextAction || ''} onChange={e => setEditingLead({ ...editingLead, nextAction: e.target.value })} placeholder="Ex.: Mandar proposta" disabled={CLOSED.includes(editingLead.status)} /></label>
                  {CLOSED.includes(editingLead.status) && <small>Leads vendidos ou perdidos não precisam de próximo contato.</small>}
                </div>
              </section>

              <section className="detail-card">
                <div className="section-heading"><div><h2>Ações</h2><p>Salve antes de avançar a negociação.</p></div></div>
                <div className="detail-actions-stack">
                  <button type="button" className="detail-whatsapp" onClick={() => openWhatsApp(selectedLead)}><MessageCircle size={17} /> Abrir conversa no WhatsApp</button>
                  <button type="submit" className="detail-action sold-action"><Save size={17} /> Salvar alterações</button>
                  <button type="button" className="detail-action" onClick={() => { setEditingLead(null); setFormError(''); }}><X size={17} /> Cancelar edição</button>
                </div>
              </section>
            </aside>
          </form>
'''
app.write_text(text[:start] + replacement + text[end:])

css = Path('src/detail.css')
css_text = css.read_text()
if '.inline-detail-edit{' not in css_text:
    css_text += '''\n\n/* Inline lead detail editing */\n.inline-detail-edit{margin:0}.inline-section-heading{gap:16px}.inline-edit-actions{display:flex;gap:7px;align-items:center}.inline-edit-actions .primary-button,.inline-edit-actions .secondary-button{height:34px;padding:0 11px;font-size:10px}.info-edit-item{cursor:text;align-items:center}.info-edit-item>div{flex:1;min-width:0}.info-edit-item input,.info-edit-item select{width:100%;min-width:0;border:0;border-bottom:1px solid #d0d5dd;border-radius:0;background:transparent;padding:4px 0 3px;color:#101828;font:inherit;font-size:11px;font-weight:600;outline:none}.info-edit-item input:focus,.info-edit-item select:focus{border-bottom-color:#16a36a;box-shadow:0 1px 0 #16a36a}.inline-edit-error{margin-top:12px}.inline-notes-editor{display:block;width:100%;min-height:96px;resize:vertical;border:1px solid #edf0f2;border-radius:10px;background:#f9fafb;padding:13px;color:#475467;font:inherit;font-size:11px;line-height:1.55;outline:none}.inline-notes-editor:focus{border-color:#79c9a7;box-shadow:0 0 0 3px rgba(22,163,106,.09)}.inline-next-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.inline-next-form label{display:flex;flex-direction:column;gap:5px}.inline-next-form label.full{grid-column:1/-1}.inline-next-form label>span{font-size:9px;color:#98a2b3}.inline-next-form input{width:100%;min-width:0;height:36px;border:1px solid #e0e4e8;border-radius:8px;background:#fff;padding:0 9px;color:#344054;font:inherit;font-size:10px;outline:none}.inline-next-form input:focus{border-color:#79c9a7;box-shadow:0 0 0 3px rgba(22,163,106,.08)}.inline-next-form input:disabled{opacity:.55;background:#f5f6f7}.inline-next-form small{grid-column:1/-1;color:#98a2b3;font-size:9px;line-height:1.4}\nhtml[data-theme="dark"] .info-edit-item input,html[data-theme="dark"] .info-edit-item select{color:#f5f7fa;border-bottom-color:#46505d}html[data-theme="dark"] .inline-notes-editor,html[data-theme="dark"] .inline-next-form input{background:#14181e;border-color:#343c48;color:#eef2f6}html[data-theme="dark"] .inline-next-form input:disabled{background:#111419}\n@media(max-width:620px){.inline-section-heading{flex-direction:column}.inline-edit-actions{width:100%}.inline-edit-actions .primary-button,.inline-edit-actions .secondary-button{flex:1;min-height:40px}.inline-next-form{grid-template-columns:1fr}.inline-next-form label.full,.inline-next-form small{grid-column:auto}}\n'''
    css.write_text(css_text)
