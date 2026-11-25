import React, { useState } from 'react';
import { LogOut, Save } from 'lucide-react';
import { updateProfileName } from './backendBridge';
import './settings.css';

export default function SettingsPage({ account, onAccountChange, onLogout, demoMode = false }) {
  const [name, setName] = useState(account?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const save = async event => {
    event.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) { setMessage('Digite um nome com pelo menos 2 letras.'); return; }
    setSaving(true);
    setMessage('');
    try {
      if (!demoMode && account?.id) await updateProfileName(account.id, clean);
      onAccountChange({ ...account, name: clean });
      setMessage('Nome salvo.');
    } catch (error) {
      console.error(error);
      setMessage('Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content settings-page">
      <header className="page-header"><div><h1>Configurações</h1><p>Sua conta.</p></div></header>
      <form className="detail-card" onSubmit={save} style={{ maxWidth: 480, display: 'grid', gap: 12 }}>
        <label><span>Nome</span><input value={name} onChange={event => setName(event.target.value)} /></label>
        {account?.email && <label><span>E-mail</span><input value={account.email} disabled /></label>}
        {message && <div role="status">{message}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onLogout}><LogOut size={16} /> Sair</button>
          <button className="primary-button" disabled={saving}><Save size={16} /> Salvar</button>
        </div>
      </form>
    </main>
  );
}
