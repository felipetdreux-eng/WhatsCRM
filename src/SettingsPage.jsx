import React, { useState } from 'react';
import { BriefcaseBusiness, Check, LogOut, Mail, Save, ShieldCheck, Target, UserRound } from 'lucide-react';
import { updateProfileName } from './backendBridge';
import './settings.css';

const GOAL_LABELS = {
  organize: 'Organizar leads',
  followups: 'Lembrar follow-ups',
  sales: 'Aumentar vendas',
};

const SELLING_LABELS = {
  services: 'Serviços',
  products: 'Produtos',
  both: 'Produtos e serviços',
};

export default function SettingsPage({ account, onAccountChange, onLogout }) {
  const [name, setName] = useState(account?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const saveProfile = async event => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError('Digite um nome com pelo menos 2 caracteres.');
      setNotice('');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateProfileName(account?.id, cleanName);
      onAccountChange?.({ ...account, name: cleanName });
      setName(cleanName);
      setNotice('Nome atualizado com sucesso.');
    } catch (saveError) {
      console.error('ZapFlow profile update failed:', saveError);
      setError('Não foi possível salvar seu nome agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-kicker"><ShieldCheck size={14} /> Conta e preferências</span>
          <h1>Configurações</h1>
          <p>Gerencie as informações básicas da sua conta ZapFlow.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card" aria-labelledby="profile-settings-title">
          <div className="settings-card-heading">
            <div className="settings-icon"><UserRound size={19} /></div>
            <div><h2 id="profile-settings-title">Perfil</h2><p>Esse nome aparece dentro do ZapFlow.</p></div>
          </div>

          <form className="settings-form" onSubmit={saveProfile}>
            <label>
              <span>Nome</span>
              <input value={name} onChange={event => setName(event.target.value)} autoComplete="name" />
            </label>
            <label>
              <span>Email</span>
              <div className="settings-readonly"><Mail size={16} /><span>{account?.email || 'Não informado'}</span></div>
            </label>

            {error && <div className="settings-error" role="alert">{error}</div>}
            {notice && <div className="settings-success" role="status"><Check size={15} /> {notice}</div>}

            <button className="primary-button settings-save" disabled={saving}>
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar nome'}
            </button>
          </form>
        </section>

        <section className="settings-card" aria-labelledby="preferences-settings-title">
          <div className="settings-card-heading">
            <div className="settings-icon"><Target size={19} /></div>
            <div><h2 id="preferences-settings-title">Seu ZapFlow</h2><p>Resumo das escolhas feitas no cadastro.</p></div>
          </div>

          <dl className="settings-summary">
            <div><dt><BriefcaseBusiness size={16} /> Tipo de venda</dt><dd>{SELLING_LABELS[account?.onboarding?.selling] || 'Não informado'}</dd></div>
            <div><dt><Target size={16} /> Objetivo</dt><dd>{GOAL_LABELS[account?.onboarding?.goal] || 'Não informado'}</dd></div>
            <div><dt><ShieldCheck size={16} /> Dados</dt><dd>Supabase com isolamento por conta</dd></div>
          </dl>
        </section>

        <section className="settings-card settings-session" aria-labelledby="session-settings-title">
          <div className="settings-card-heading">
            <div className="settings-icon neutral"><LogOut size={19} /></div>
            <div><h2 id="session-settings-title">Sessão</h2><p>Encerre o acesso neste navegador.</p></div>
          </div>
          <button type="button" className="settings-logout" onClick={onLogout}><LogOut size={16} /> Sair da conta</button>
        </section>
      </div>
    </main>
  );
}
