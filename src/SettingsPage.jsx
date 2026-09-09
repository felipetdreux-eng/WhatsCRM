import React, { useState } from 'react';
import { BriefcaseBusiness, Check, CircleHelp, LogOut, Mail, Moon, Play, Save, ShieldCheck, Sun, Target, UserRound } from 'lucide-react';
import { updateProfileName, updateProfileTheme } from './backendBridge';
import './settings.css';
import './dark.css';
import './dark-integrated.css';

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
  const [theme, setTheme] = useState(account?.theme === 'dark' ? 'dark' : 'light');
  const [saving, setSaving] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
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
      onAccountChange?.({ ...account, name: cleanName, theme });
      setName(cleanName);
      setNotice('Nome atualizado com sucesso.');
    } catch (saveError) {
      console.error('ZapFlow profile update failed:', saveError);
      setError('Não foi possível salvar seu nome agora.');
    } finally {
      setSaving(false);
    }
  };

  const changeTheme = async nextTheme => {
    if (savingTheme || nextTheme === theme) return;
    const previousTheme = theme;
    setTheme(nextTheme);
    setSavingTheme(true);
    setError('');
    setNotice('');
    document.documentElement.dataset.theme = nextTheme;
    try {
      await updateProfileTheme(account?.id, nextTheme);
      onAccountChange?.({ ...account, theme: nextTheme });
      setNotice(nextTheme === 'dark' ? 'Modo escuro ativado.' : 'Modo claro ativado.');
    } catch (themeError) {
      console.error('ZapFlow theme update failed:', themeError);
      setTheme(previousTheme);
      document.documentElement.dataset.theme = previousTheme;
      setError('Não foi possível salvar a aparência agora.');
    } finally {
      setSavingTheme(false);
    }
  };

  const restartTutorial = () => {
    window.dispatchEvent(new Event('zapflow:start-tutorial'));
  };

  return (
    <main className="main-content settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-kicker"><ShieldCheck size={14} /> Conta e preferências</span>
          <h1>Configurações</h1>
          <p>Gerencie as informações básicas da sua conta ZapFlow.</p>
        </div>
        <button type="button" className="settings-tutorial-shortcut" onClick={restartTutorial}>
          <Play size={16} /> Rever tutorial
        </button>
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

        <section className="settings-card" aria-labelledby="appearance-settings-title">
          <div className="settings-card-heading">
            <div className="settings-icon"><Moon size={19} /></div>
            <div><h2 id="appearance-settings-title">Aparência</h2><p>Escolha como o sistema fica neste e nos outros dispositivos.</p></div>
          </div>
          <div className="theme-picker" role="radiogroup" aria-label="Tema do sistema">
            <button type="button" role="radio" aria-checked={theme === 'light'} className={theme === 'light' ? 'active' : ''} onClick={() => changeTheme('light')} disabled={savingTheme}>
              <Sun size={18} />
              <span><strong>Claro</strong><small>Visual padrão</small></span>
              {theme === 'light' && <Check size={16} className="theme-check" />}
            </button>
            <button type="button" role="radio" aria-checked={theme === 'dark'} className={theme === 'dark' ? 'active' : ''} onClick={() => changeTheme('dark')} disabled={savingTheme}>
              <Moon size={18} />
              <span><strong>Escuro</strong><small>Mais confortável à noite</small></span>
              {theme === 'dark' && <Check size={16} className="theme-check" />}
            </button>
          </div>
        </section>

        <section className="settings-card" aria-labelledby="help-settings-title">
          <div className="settings-card-heading">
            <div className="settings-icon"><CircleHelp size={19} /></div>
            <div><h2 id="help-settings-title">Ajuda</h2><p>Revise o fluxo principal do sistema quando quiser.</p></div>
          </div>
          <button type="button" className="settings-help-button" onClick={restartTutorial}><Play size={16} /> Ver tutorial novamente</button>
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
