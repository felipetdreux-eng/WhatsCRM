import React, { useEffect, useMemo, useState } from 'react';
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
import './authflow.css';

const ACCOUNTS_KEY = 'zapflow-accounts';
const SESSION_KEY = 'zapflow-session';

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
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
      <div className="auth-brand">
        <div className="auth-brand-mark"><MessageCircle size={25} strokeWidth={2.4} /></div>
        <span>ZapFlow</span>
      </div>
      <div className="auth-brand-copy">
        <span className="auth-eyebrow">Venda pelo WhatsApp sem perder o fio</span>
        <h1>Seus clientes estão no WhatsApp. Suas vendas não precisam estar perdidas nele.</h1>
        <p>Organize contatos, acompanhe negociações e saiba exatamente quem precisa de resposta.</p>
      </div>
      <div className="auth-brand-points">
        <span><Check size={15} /> Pipeline simples</span>
        <span><Check size={15} /> Follow-ups no lugar certo</span>
        <span><Check size={15} /> WhatsApp em um clique</span>
      </div>
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
  const [loading, setLoading] = useState(false);

  const switchMode = next => {
    setMode(next);
    setError('');
    setPassword('');
  };

  const submit = async event => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Digite um email válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      setError('Digite seu nome.');
      return;
    }

    setLoading(true);
    try {
      const accounts = readJSON(ACCOUNTS_KEY, []);
      const passwordHash = await hashPassword(password);

      if (mode === 'register') {
        if (accounts.some(account => account.email === normalizedEmail)) {
          setError('Já existe uma conta com esse email neste navegador.');
          return;
        }
        const account = {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          createdAt: new Date().toISOString(),
          onboardingCompleted: false,
          onboarding: null,
        };
        const nextAccounts = [...accounts, account];
        saveAccounts(nextAccounts);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: account.id, email: account.email }));
        onAuthenticated(account);
        return;
      }

      const account = accounts.find(item => item.email === normalizedEmail);
      if (!account || account.passwordHash !== passwordHash) {
        setError('Email ou senha incorretos.');
        return;
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: account.id, email: account.email }));
      onAuthenticated(account);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-layout">
        <BrandPanel />
        <main className="auth-form-panel">
          <div className="auth-mobile-brand">
            <div className="auth-brand-mark"><MessageCircle size={21} /></div>
            <span>ZapFlow</span>
          </div>

          <section className="auth-card">
            <div className="auth-tabs" role="tablist" aria-label="Acesso">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">Entrar</button>
              <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Criar conta</button>
            </div>

            <div className="auth-card-heading">
              <h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
              <p>{mode === 'login' ? 'Entre para continuar suas negociações.' : 'Comece a organizar suas vendas em poucos passos.'}</p>
            </div>

            <form className="auth-form" onSubmit={submit}>
              {mode === 'register' && (
                <label>
                  <span>Nome</span>
                  <div className="auth-input"><UserRound size={17} /><input value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" autoComplete="name" /></div>
                </label>
              )}
              <label>
                <span>Email</span>
                <div className="auth-input"><Mail size={17} /><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" /></div>
              </label>
              <label>
                <span>Senha</span>
                <div className="auth-input"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" className="auth-eye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              </label>

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button className="auth-submit" disabled={loading}>
                {loading ? 'Processando...' : mode === 'login' ? 'Entrar no ZapFlow' : 'Criar conta'}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="auth-local-note">Versão de teste: o acesso fica salvo apenas neste navegador até conectarmos o banco de dados real.</p>
          </section>
        </main>
      </div>
    </div>
  );
}

function Onboarding({ account, onComplete }) {
  const [step, setStep] = useState(1);
  const [selling, setSelling] = useState(account.onboarding?.selling || '');
  const [goal, setGoal] = useState(account.onboarding?.goal || '');
  const [startMode, setStartMode] = useState(account.onboarding?.startMode || 'demo');

  const canContinue = step === 1 ? Boolean(selling) : step === 2 ? Boolean(goal) : Boolean(startMode);

  const finish = () => {
    const accounts = readJSON(ACCOUNTS_KEY, []);
    const onboarding = { selling, goal, startMode, completedAt: new Date().toISOString() };
    const nextAccounts = accounts.map(item => item.id === account.id
      ? { ...item, onboardingCompleted: true, onboarding }
      : item);
    saveAccounts(nextAccounts);

    if (startMode === 'empty') {
      localStorage.setItem('zapflow-leads', JSON.stringify([]));
    } else {
      localStorage.removeItem('zapflow-leads');
    }

    onComplete({ ...account, onboardingCompleted: true, onboarding });
  };

  return (
    <div className="auth-overlay onboarding-overlay">
      <main className="onboarding-shell">
        <header className="onboarding-topbar">
          <div className="auth-brand compact">
            <div className="auth-brand-mark"><MessageCircle size={21} /></div>
            <span>ZapFlow</span>
          </div>
          <div className="onboarding-progress-copy">Passo {step} de 3</div>
        </header>

        <div className="onboarding-progress"><span style={{ width: `${(step / 3) * 100}%` }} /></div>

        <section className="onboarding-card">
          {step === 1 && (
            <>
              <span className="onboarding-kicker">Pra começar</span>
              <h1>Como você vende?</h1>
              <p>Isso ajuda o ZapFlow a organizar sua experiência sem jogar 47 configurações inúteis na sua cara.</p>
              <div className="onboarding-options">
                {SELL_OPTIONS.map(option => {
                  const Icon = option.icon;
                  return <button key={option.id} className={selling === option.id ? 'selected' : ''} onClick={() => setSelling(option.id)}><div className="onboarding-option-icon"><Icon size={20} /></div><div><strong>{option.title}</strong><span>{option.text}</span></div>{selling === option.id && <Check className="onboarding-check" size={17} />}</button>;
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="onboarding-kicker">Seu foco</span>
              <h1>Qual é seu principal objetivo?</h1>
              <p>Escolha o problema que você mais quer parar de carregar na cabeça.</p>
              <div className="onboarding-options">
                {GOAL_OPTIONS.map(option => {
                  const Icon = option.icon;
                  return <button key={option.id} className={goal === option.id ? 'selected' : ''} onClick={() => setGoal(option.id)}><div className="onboarding-option-icon"><Icon size={20} /></div><div><strong>{option.title}</strong><span>{option.text}</span></div>{goal === option.id && <Check className="onboarding-check" size={17} />}</button>;
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="onboarding-kicker">Último passo</span>
              <h1>Como quer começar?</h1>
              <p>Você pode explorar o ZapFlow com exemplos ou entrar com o sistema limpo.</p>
              <div className="onboarding-start-grid">
                <button className={startMode === 'demo' ? 'selected' : ''} onClick={() => setStartMode('demo')}>
                  <div className="onboarding-option-icon"><Sparkles size={21} /></div>
                  <strong>Usar dados de exemplo</strong>
                  <span>Veja o pipeline, leads e follow-ups já preenchidos.</span>
                  {startMode === 'demo' && <Check className="onboarding-check" size={17} />}
                </button>
                <button className={startMode === 'empty' ? 'selected' : ''} onClick={() => setStartMode('empty')}>
                  <div className="onboarding-option-icon"><UsersRound size={21} /></div>
                  <strong>Começar vazio</strong>
                  <span>Entre sem contatos e adicione seu primeiro lead.</span>
                  {startMode === 'empty' && <Check className="onboarding-check" size={17} />}
                </button>
              </div>
            </>
          )}

          <footer className="onboarding-actions">
            <button type="button" className="onboarding-back" disabled={step === 1} onClick={() => setStep(value => Math.max(1, value - 1))}><ArrowLeft size={17} /> Voltar</button>
            {step < 3
              ? <button className="onboarding-next" disabled={!canContinue} onClick={() => setStep(value => Math.min(3, value + 1))}>Continuar <ArrowRight size={17} /></button>
              : <button className="onboarding-next" disabled={!canContinue} onClick={finish}>Entrar no ZapFlow <ArrowRight size={17} /></button>}
          </footer>
        </section>
      </main>
    </div>
  );
}

function AuthFlow() {
  const accounts = useMemo(() => readJSON(ACCOUNTS_KEY, []), []);
  const session = useMemo(() => readJSON(SESSION_KEY, null), []);
  const initialAccount = session ? accounts.find(account => account.id === session.accountId) || null : null;

  const [account, setAccount] = useState(initialAccount);
  const [phase, setPhase] = useState(() => {
    if (!initialAccount) return 'auth';
    return initialAccount.onboardingCompleted ? 'done' : 'onboarding';
  });

  useEffect(() => {
    if (phase !== 'done') document.body.classList.add('auth-locked');
    else document.body.classList.remove('auth-locked');
    return () => document.body.classList.remove('auth-locked');
  }, [phase]);

  const authenticated = nextAccount => {
    setAccount(nextAccount);
    setPhase(nextAccount.onboardingCompleted ? 'done' : 'onboarding');
  };

  const completed = nextAccount => {
    setAccount(nextAccount);
    setPhase('done');
    window.location.reload();
  };

  if (phase === 'done') return null;
  if (phase === 'onboarding' && account) return <Onboarding account={account} onComplete={completed} />;
  return <AuthScreen onAuthenticated={authenticated} />;
}

const host = document.getElementById('auth-root');
if (host) createRoot(host).render(<AuthFlow />);
