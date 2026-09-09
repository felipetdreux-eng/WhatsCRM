import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MessageCircle,
  Package,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { getProfile } from './backendBridge';
import { ACCOUNTS_KEY, readJSON } from './accountStorage';
import './authflow.css';

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const SELL_OPTIONS = [
  { id: 'services', title: 'Serviços', text: 'Freelas, agências, técnicos e profissionais.', icon: BriefcaseBusiness },
  { id: 'products', title: 'Produtos', text: 'Vendas de produtos e pedidos pelo WhatsApp.', icon: Package },
  { id: 'both', title: 'Ambos', text: 'Você vende produtos e serviços.', icon: Sparkles },
];

const GOAL_OPTIONS = [
  { id: 'organize', title: 'Organizar leads', text: 'Centralizar contatos e negociações.', icon: UsersRound },
  { id: 'followups', title: 'Lembrar follow-ups', text: 'Não esquecer quem precisa de retorno.', icon: Target },
  { id: 'sales', title: 'Aumentar vendas', text: 'Acompanhar melhor cada oportunidade.', icon: LayoutDashboard },
];

function BrandPanel() {
  return (
    <aside className="auth-brand-panel">
      <div className="auth-brand"><div className="auth-brand-mark"><MessageCircle size={25} strokeWidth={2.4} /></div><span>ZapFlow</span></div>
      <div className="auth-brand-copy">
        <span className="auth-eyebrow">Venda pelo WhatsApp sem perder o fio</span>
        <h1>Seus clientes estão no WhatsApp. Suas vendas não precisam estar perdidas nele.</h1>
        <p>Organize contatos, acompanhe negociações e saiba exatamente quem precisa de resposta.</p>
      </div>
      <div className="auth-brand-points"><span><Check size={15} /> Pipeline simples</span><span><Check size={15} /> Follow-ups no lugar certo</span><span><Check size={15} /> WhatsApp em um clique</span></div>
    </aside>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = next => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
  };

  const tryLegacyMigration = async (normalizedEmail, plainPassword) => {
    const accounts = readJSON(ACCOUNTS_KEY, []);
    const legacy = Array.isArray(accounts) ? accounts.find(account => String(account.email || '').toLowerCase() === normalizedEmail && account.passwordHash) : null;
    if (!legacy) return false;
    const passwordHash = await hashPassword(plainPassword);
    if (legacy.passwordHash !== passwordHash) return false;

    const { data, error: signupError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: plainPassword,
      options: { data: { name: legacy.name || normalizedEmail.split('@')[0] } },
    });

    if (signupError) {
      setError(signupError.message.includes('registered')
        ? 'Essa conta já existe no backend. Se a senha não entrar, use a recuperação de senha.'
        : signupError.message);
      return true;
    }

    if (data.session && data.user) {
      onAuthenticated(data.user);
    } else {
      setNotice('Sua conta antiga foi migrada. Confirme o email enviado pelo Supabase e depois entre normalmente.');
    }
    return true;
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) return setError('Digite um email válido.');
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (mode === 'register' && name.trim().length < 2) return setError('Digite seu nome.');

    setLoading(true);
    try {
      if (mode === 'register') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { name: name.trim() } },
        });
        if (signupError) return setError(signupError.message);
        if (data.session && data.user) onAuthenticated(data.user);
        else setNotice('Conta criada. Confirme o email que o Supabase enviou antes de entrar.');
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (!loginError && data.user) {
        onAuthenticated(data.user);
        return;
      }

      if (loginError?.message?.toLowerCase().includes('email not confirmed')) {
        setError('Seu email ainda não foi confirmado. Abra a mensagem do Supabase e confirme a conta.');
        return;
      }

      const handledLegacy = await tryLegacyMigration(normalizedEmail, password);
      if (!handledLegacy) setError('Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-layout">
        <BrandPanel />
        <main className="auth-form-panel">
          <div className="auth-mobile-brand"><div className="auth-brand-mark"><MessageCircle size={21} /></div><span>ZapFlow</span></div>
          <section className="auth-card">
            <div className="auth-tabs" role="tablist" aria-label="Acesso">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">Entrar</button>
              <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Criar conta</button>
            </div>
            <div className="auth-card-heading"><h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2><p>{mode === 'login' ? 'Entre para continuar suas negociações.' : 'Comece a organizar suas vendas em poucos passos.'}</p></div>
            <form className="auth-form" onSubmit={submit}>
              {mode === 'register' && <label><span>Nome</span><div className="auth-input"><UserRound size={17} /><input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" /></div></label>}
              <label><span>Email</span><div className="auth-input"><Mail size={17} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" /></div></label>
              <label><span>Senha</span><div className="auth-input"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" className="auth-eye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              {notice && <div className="auth-error" role="status" style={{ background: '#eefaf4', color: '#126b47', borderColor: '#cdebdc' }}>{notice}</div>}
              <button className="auth-submit" disabled={loading}>{loading ? 'Processando...' : mode === 'login' ? 'Entrar no ZapFlow' : 'Criar conta'}{!loading && <ArrowRight size={17} />}</button>
            </form>
            <p className="auth-local-note">Acesso protegido pelo Supabase Auth. Seus leads ficam vinculados à sua conta.</p>
          </section>
        </main>
      </div>
    </div>
  );
}

function Onboarding({ user, profile, onComplete }) {
  const [step, setStep] = useState(1);
  const [selling, setSelling] = useState(profile?.selling_type || '');
  const [goal, setGoal] = useState(profile?.goal || '');
  const [startMode, setStartMode] = useState(profile?.start_mode || 'demo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canContinue = step === 1 ? Boolean(selling) : step === 2 ? Boolean(goal) : Boolean(startMode);

  const finish = async () => {
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.from('profiles').update({
      selling_type: selling,
      goal,
      start_mode: startMode,
      onboarding_completed: true,
    }).eq('id', user.id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    onComplete();
  };

  return (
    <div className="auth-overlay onboarding-overlay">
      <main className="onboarding-shell">
        <header className="onboarding-topbar"><div className="auth-brand compact"><div className="auth-brand-mark"><MessageCircle size={21} /></div><span>ZapFlow</span></div><div className="onboarding-progress-copy">Passo {step} de 3</div></header>
        <div className="onboarding-progress"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
        <section className="onboarding-card">
          {step === 1 && <><span className="onboarding-kicker">Pra começar</span><h1>Como você vende?</h1><p>Isso ajuda o ZapFlow a adaptar sua experiência sem jogar 47 configurações inúteis na sua cara.</p><div className="onboarding-options">{SELL_OPTIONS.map(option => { const Icon = option.icon; return <button key={option.id} className={selling === option.id ? 'selected' : ''} onClick={() => setSelling(option.id)}><div className="onboarding-option-icon"><Icon size={20} /></div><div><strong>{option.title}</strong><span>{option.text}</span></div>{selling === option.id && <Check className="onboarding-check" size={17} />}</button>; })}</div></>}
          {step === 2 && <><span className="onboarding-kicker">Seu foco</span><h1>Qual é seu principal objetivo?</h1><p>Escolha o problema que você mais quer parar de carregar na cabeça.</p><div className="onboarding-options">{GOAL_OPTIONS.map(option => { const Icon = option.icon; return <button key={option.id} className={goal === option.id ? 'selected' : ''} onClick={() => setGoal(option.id)}><div className="onboarding-option-icon"><Icon size={20} /></div><div><strong>{option.title}</strong><span>{option.text}</span></div>{goal === option.id && <Check className="onboarding-check" size={17} />}</button>; })}</div></>}
          {step === 3 && <><span className="onboarding-kicker">Último passo</span><h1>Como quer começar?</h1><p>Você pode explorar o ZapFlow com exemplos ou entrar com o sistema limpo.</p><div className="onboarding-start-grid"><button className={startMode === 'demo' ? 'selected' : ''} onClick={() => setStartMode('demo')}><div className="onboarding-option-icon"><Sparkles size={21} /></div><strong>Usar dados de exemplo</strong><span>Veja o pipeline, leads e follow-ups já preenchidos.</span>{startMode === 'demo' && <Check className="onboarding-check" size={17} />}</button><button className={startMode === 'empty' ? 'selected' : ''} onClick={() => setStartMode('empty')}><div className="onboarding-option-icon"><UsersRound size={21} /></div><strong>Começar vazio</strong><span>Entre sem contatos e adicione seu primeiro lead.</span>{startMode === 'empty' && <Check className="onboarding-check" size={17} />}</button></div></>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <footer className="onboarding-actions"><button type="button" className="onboarding-back" disabled={step === 1 || saving} onClick={() => setStep(value => Math.max(1, value - 1))}><ArrowLeft size={17} /> Voltar</button>{step < 3 ? <button className="onboarding-next" disabled={!canContinue || saving} onClick={() => setStep(value => Math.min(3, value + 1))}>Continuar <ArrowRight size={17} /></button> : <button className="onboarding-next" disabled={!canContinue || saving} onClick={finish}>{saving ? 'Salvando...' : 'Entrar no ZapFlow'} {!saving && <ArrowRight size={17} />}</button>}</footer>
        </section>
      </main>
    </div>
  );
}

function AuthFlow() {
  const [phase, setPhase] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const resolveUser = async nextUser => {
    if (!nextUser) {
      setUser(null);
      setProfile(null);
      setPhase('auth');
      return;
    }
    try {
      const nextProfile = await getProfile(nextUser.id);
      setUser(nextUser);
      setProfile(nextProfile);
      setPhase(nextProfile?.onboarding_completed ? 'done' : 'onboarding');
    } catch {
      setUser(nextUser);
      setProfile(null);
      setPhase('onboarding');
    }
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) resolveUser(data.user || null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) resolveUser(session?.user || null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (phase !== 'done') document.body.classList.add('auth-locked');
    else document.body.classList.remove('auth-locked');
    return () => document.body.classList.remove('auth-locked');
  }, [phase]);

  if (phase === 'loading') return <div className="auth-overlay" />;
  if (phase === 'done') return null;
  if (phase === 'onboarding' && user) return <Onboarding user={user} profile={profile} onComplete={() => window.location.reload()} />;
  return <AuthScreen onAuthenticated={resolveUser} />;
}

const host = document.getElementById('auth-root');
if (host) createRoot(host).render(<AuthFlow />);
