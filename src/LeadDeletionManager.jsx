import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Search, Trash2, X } from 'lucide-react';
import { getActiveAccount } from './accountStorage';
import { supabase } from './supabaseClient';
import './lead-delete.css';

export default function LeadDeletionManager({ leads, setLeads, demoMode = false }) {
  const [headerTarget, setHeaderTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHeaderTarget(document.querySelector('.leads-header-actions')));
    return () => cancelAnimationFrame(frame);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(lead => `${lead.name} ${lead.company || ''} ${lead.phone || ''} ${lead.status || ''}`.toLowerCase().includes(q));
  }, [leads, query]);

  const keepEmptyState = async userId => {
    if (!userId || demoMode) return;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ start_mode: 'empty' })
      .eq('id', userId);
    if (profileError) console.error('Could not persist empty lead state:', profileError);
  };

  const activeWorkspaceId = async userId => {
    if (!userId) return null;
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('active_workspace_id')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;
    return data?.active_workspace_id || null;
  };

  const deleteOne = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    try {
      const account = getActiveAccount();
      if (!demoMode) {
        if (!account?.id) throw new Error('Conta não encontrada.');
        const workspaceId = await activeWorkspaceId(account.id);
        if (!workspaceId) throw new Error('Equipe ativa não encontrada.');
        const { error: deleteError } = await supabase
          .from('leads')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('id', target.id);
        if (deleteError) throw deleteError;
      }

      const remaining = leads.filter(lead => lead.id !== target.id);
      setLeads(remaining);
      if (!demoMode && remaining.length === 0) await keepEmptyState(account?.id);
      setTarget(null);
    } catch (deleteError) {
      console.error('Lead deletion failed:', deleteError);
      setError('Não foi possível excluir este lead. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (confirmation.trim().toUpperCase() !== 'EXCLUIR' || busy) return;
    setBusy(true);
    setError('');
    try {
      const account = getActiveAccount();
      if (!demoMode) {
        if (!account?.id) throw new Error('Conta não encontrada.');
        const workspaceId = await activeWorkspaceId(account.id);
        if (!workspaceId) throw new Error('Equipe ativa não encontrada.');
        const { error: deleteError } = await supabase
          .from('leads')
          .delete()
          .eq('workspace_id', workspaceId);
        if (deleteError) throw deleteError;
        await keepEmptyState(account.id);
      }

      setLeads([]);
      setDeleteAllOpen(false);
      setConfirmation('');
      setOpen(false);
    } catch (deleteError) {
      console.error('Delete all leads failed:', deleteError);
      setError('Não foi possível excluir todos os leads. Nada foi removido da tela.');
    } finally {
      setBusy(false);
    }
  };

  const trigger = (
    <button type="button" className="lead-delete-trigger" onClick={() => { setOpen(true); setError(''); }} disabled={!leads.length}>
      <Trash2 size={16} /> Excluir leads
    </button>
  );

  return (
    <>
      {headerTarget ? createPortal(trigger, headerTarget) : null}

      {open && (
        <div className="lead-delete-backdrop" onMouseDown={() => !busy && setOpen(false)}>
          <section className="lead-delete-modal" role="dialog" aria-modal="true" aria-labelledby="lead-delete-title" onMouseDown={event => event.stopPropagation()}>
            <div className="lead-delete-header">
              <div>
                <span>Gerenciar exclusão</span>
                <h2 id="lead-delete-title">Excluir leads</h2>
                <p>Escolha um lead para remover definitivamente ou apague a base inteira.</p>
              </div>
              <button type="button" className="lead-delete-close" onClick={() => setOpen(false)} disabled={busy} aria-label="Fechar"><X size={19} /></button>
            </div>

            <div className="lead-delete-toolbar">
              <label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar lead" /></label>
              <button type="button" className="lead-delete-all-button" onClick={() => { setDeleteAllOpen(true); setError(''); }} disabled={!leads.length || busy}><Trash2 size={15} /> Excluir todos</button>
            </div>

            {error && <div className="lead-delete-error" role="alert">{error}</div>}

            <div className="lead-delete-list">
              {filtered.map(lead => (
                <div className="lead-delete-row" key={lead.id}>
                  <div className="lead-delete-avatar">{String(lead.name || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="lead-delete-copy"><strong>{lead.name}</strong><span>{lead.company || lead.phone || 'Sem empresa'} · {lead.status}</span></div>
                  <button type="button" onClick={() => { setTarget(lead); setError(''); }} disabled={busy} aria-label={`Excluir ${lead.name}`}><Trash2 size={15} /> Excluir</button>
                </div>
              ))}
              {!filtered.length && <div className="lead-delete-empty">Nenhum lead encontrado.</div>}
            </div>
          </section>
        </div>
      )}

      {target && (
        <div className="lead-delete-backdrop lead-delete-confirm-layer" onMouseDown={() => !busy && setTarget(null)}>
          <section className="lead-delete-confirm" role="alertdialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <div className="lead-delete-warning-icon"><AlertTriangle size={21} /></div>
            <h3>Excluir {target.name}?</h3>
            <p>Esse lead e o histórico dele serão apagados definitivamente. Não tem botão mágico de desfazer depois.</p>
            {error && <div className="lead-delete-error" role="alert">{error}</div>}
            <div className="lead-delete-confirm-actions">
              <button type="button" className="lead-delete-cancel" onClick={() => setTarget(null)} disabled={busy}>Cancelar</button>
              <button type="button" className="lead-delete-danger" onClick={deleteOne} disabled={busy}>{busy ? 'Excluindo…' : 'Excluir lead'}</button>
            </div>
          </section>
        </div>
      )}

      {deleteAllOpen && (
        <div className="lead-delete-backdrop lead-delete-confirm-layer" onMouseDown={() => !busy && setDeleteAllOpen(false)}>
          <section className="lead-delete-confirm lead-delete-confirm-all" role="alertdialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <div className="lead-delete-warning-icon"><AlertTriangle size={21} /></div>
            <h3>Excluir todos os {leads.length} leads?</h3>
            <p>Isso remove toda a base de leads e seus históricos. Para confirmar, digite <strong>EXCLUIR</strong>.</p>
            <input className="lead-delete-confirm-input" autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Digite EXCLUIR" disabled={busy} />
            {error && <div className="lead-delete-error" role="alert">{error}</div>}
            <div className="lead-delete-confirm-actions">
              <button type="button" className="lead-delete-cancel" onClick={() => { setDeleteAllOpen(false); setConfirmation(''); }} disabled={busy}>Cancelar</button>
              <button type="button" className="lead-delete-danger" onClick={deleteAll} disabled={busy || confirmation.trim().toUpperCase() !== 'EXCLUIR'}>{busy ? 'Excluindo…' : 'Excluir tudo'}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
