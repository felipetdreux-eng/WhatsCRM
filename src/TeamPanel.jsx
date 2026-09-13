import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Crown, LogIn, RefreshCw, Save, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import {
  createWorkspaceInvite,
  joinWorkspaceByCode,
  loadWorkspaceContext,
  renameWorkspace,
  setActiveWorkspace,
} from './backendBridge';
import './team.css';

const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
};

function initials(name) {
  const parts = String(name || 'Membro').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) || 'ME').toUpperCase();
}

export default function TeamPanel({ account, demoMode = false }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeWorkspace = context?.activeWorkspace || null;
  const members = context?.members || [];
  const canManage = ['owner', 'admin'].includes(context?.myRole);
  const isOwner = context?.myRole === 'owner';

  const sortedMembers = useMemo(() => [...members].sort((a, b) => {
    const priority = { owner: 0, admin: 1, member: 2 };
    return (priority[a.role] ?? 9) - (priority[b.role] ?? 9) || String(a.name).localeCompare(String(b.name));
  }), [members]);

  const refresh = async () => {
    if (demoMode) {
      const workspace = { id: 'demo-workspace', name: 'Jacob Engenharia' };
      setContext({ activeWorkspace: workspace, workspaces: [workspace], myRole: 'owner', members: [
        { user_id: account?.id || 'demo-jacob', name: account?.name || 'Comercial Jacob', role: 'owner' },
        { user_id: 'demo-eng', name: 'Engenharia', role: 'member' },
        { user_id: 'demo-dir', name: 'Diretoria', role: 'admin' },
      ] });
      setWorkspaceName(workspace.name); setLoading(false); setError(''); return;
    }
    if (!account?.id) return;
    setLoading(true);
    setError('');
    try {
      const next = await loadWorkspaceContext(account.id);
      setContext(next);
      setWorkspaceName(next.activeWorkspace?.name || '');
    } catch (loadError) {
      console.error('Team workspace load failed:', loadError);
      setError('Não foi possível carregar a equipe agora.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [account?.id, demoMode]);

  const createInvite = async () => {
    if (!activeWorkspace?.id || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const code = demoMode ? 'JACOB2026' : await createWorkspaceInvite(activeWorkspace.id);
      setInviteCode(String(code || '').toUpperCase());
      setNotice('Convite criado. O código vale por 7 dias.');
    } catch (inviteError) {
      console.error('Workspace invite failed:', inviteError);
      setError('Não foi possível criar o convite. Só proprietários e administradores podem convidar.');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setNotice('Código copiado.');
    } catch {
      setNotice(`Código: ${inviteCode}`);
    }
  };

  const joinWorkspace = async event => {
    event.preventDefault();
    if (busy) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 6) {
      setError('Digite um código de convite válido.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (demoMode) { setNotice('Demonstração: código aceito localmente.'); setJoinCode(''); return; }
      await joinWorkspaceByCode(account.id, code);
      setNotice('Você entrou na equipe. Atualizando o Fuply...');
      window.setTimeout(() => window.location.reload(), 300);
    } catch (joinError) {
      console.error('Workspace join failed:', joinError);
      setError('Código inválido, expirado ou sem vagas.');
    } finally {
      setBusy(false);
    }
  };

  const switchWorkspace = async event => {
    const workspaceId = event.target.value;
    if (!workspaceId || workspaceId === activeWorkspace?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      await setActiveWorkspace(account.id, workspaceId);
      window.location.reload();
    } catch (switchError) {
      console.error('Workspace switch failed:', switchError);
      setError('Não foi possível trocar de equipe agora.');
      setBusy(false);
    }
  };

  const saveWorkspaceName = async event => {
    event.preventDefault();
    const cleanName = workspaceName.trim();
    if (!activeWorkspace?.id || !isOwner || cleanName.length < 2) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = demoMode ? { ...activeWorkspace, name: cleanName } : await renameWorkspace(activeWorkspace.id, cleanName);
      setContext(current => ({ ...current, activeWorkspace: updated, workspaces: current.workspaces.map(item => item.id === updated.id ? updated : item) }));
      setWorkspaceName(updated.name);
      setNotice('Nome da equipe atualizado.');
    } catch (renameError) {
      console.error('Workspace rename failed:', renameError);
      setError('Não foi possível renomear a equipe. Apenas o proprietário pode fazer isso.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="settings-card team-card team-loading">
        <RefreshCw size={18} className="team-spin" /> Carregando equipe...
      </section>
    );
  }

  return (
    <section className="settings-card team-card" aria-labelledby="team-settings-title">
      <div className="settings-card-heading team-heading">
        <div className="settings-icon"><UsersRound size={19} /></div>
        <div>
          <h2 id="team-settings-title">Equipe</h2>
          <p>Compartilhe pipeline, leads e histórico sem compartilhar senha.</p>
        </div>
        <span className="team-member-count">{members.length} {members.length === 1 ? 'membro' : 'membros'}</span>
      </div>

      {context?.workspaces?.length > 1 && (
        <label className="team-workspace-select">
          <span>Equipe ativa</span>
          <select value={activeWorkspace?.id || ''} onChange={switchWorkspace} disabled={busy}>
            {context.workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </label>
      )}

      {activeWorkspace && (
        <div className="team-workspace-box">
          <div>
            <span className="team-eyebrow"><ShieldCheck size={14} /> Workspace compartilhado</span>
            <strong>{activeWorkspace.name}</strong>
          </div>
          {isOwner && (
            <form className="team-rename" onSubmit={saveWorkspaceName}>
              <input value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} maxLength={80} aria-label="Nome da equipe" />
              <button type="submit" className="secondary-button" disabled={busy || workspaceName.trim().length < 2}><Save size={15} /> Salvar</button>
            </form>
          )}
        </div>
      )}

      <div className="team-members" aria-label="Membros da equipe">
        {sortedMembers.map(member => (
          <div className="team-member" key={member.user_id}>
            <div className="team-avatar">{initials(member.name)}</div>
            <div className="team-member-copy">
              <strong>{member.name}{member.user_id === account?.id ? ' (você)' : ''}</strong>
              <span>{ROLE_LABELS[member.role] || 'Membro'}</span>
            </div>
            {member.role === 'owner' && <Crown size={17} className="team-owner-icon" aria-label="Proprietário" />}
          </div>
        ))}
      </div>

      <div className="team-actions-grid">
        <div className="team-action-box">
          <div className="team-action-title"><UserPlus size={18} /><div><strong>Convidar João, Leo ou outro membro</strong><span>Gere um código e envie para a pessoa.</span></div></div>
          {canManage ? (
            <>
              <button type="button" className="primary-button team-main-action" onClick={createInvite} disabled={busy}><UserPlus size={16} /> Gerar código</button>
              {inviteCode && (
                <div className="team-invite-code">
                  <code>{inviteCode}</code>
                  <button type="button" onClick={copyInvite}><Clipboard size={15} /> Copiar</button>
                </div>
              )}
            </>
          ) : <p className="team-muted">Só o proprietário ou um administrador pode criar convites.</p>}
        </div>

        <form className="team-action-box" onSubmit={joinWorkspace}>
          <div className="team-action-title"><LogIn size={18} /><div><strong>Entrar em outra equipe</strong><span>Cole o código que recebeu.</span></div></div>
          <input className="team-code-input" value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} placeholder="Ex.: A1B2C3D4" maxLength={12} autoCapitalize="characters" />
          <button className="secondary-button team-main-action" disabled={busy || joinCode.trim().length < 6}><LogIn size={16} /> Entrar com código</button>
        </form>
      </div>

      {error && <div className="settings-error" role="alert">{error}</div>}
      {notice && <div className="settings-success" role="status"><Check size={15} /> {notice}</div>}

      <p className="team-help">Para usar com sua equipe: cada pessoa cria a própria conta no Fuply, abre <strong>Configurações → Equipe</strong> e entra com o mesmo código de convite. A partir daí, o pipeline compartilhado passa a ser o mesmo para todos.</p>
    </section>
  );
}
