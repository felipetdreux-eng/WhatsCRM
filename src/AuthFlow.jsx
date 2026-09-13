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

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 8;

function authErrorMessage(error, fallback) {
  const raw = String(error?.message || '').trim();
  const message = raw.toLowerCase();
  if (!raw || raw === '{}' || raw === '[object object]') return fallback;
  if (message.includes('rate') || message.includes('seconds') || message.includes('too many')) {
    return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return 'Não foi possível conectar ao serviço de login. Confira sua internet e tente novamente.';
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('characters'))) {
    return 'Escolha uma senha mais forte, com pelo menos 6 caracteres.';
  }
  if (message.includes('email') && (message.includes('send') || message.includes('smtp') || message.includes('authorized'))) {
    return 'Não foi possível enviar o email de confirmação agora. Tente novamente em alguns minutos.';
  }
  return raw || fallback;
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
      <div className="auth-brand"><div className="auth-brand-mark"><MessageCircle size={25} strokeWidth={2.4} /></div><span>Fuply</span></div>
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
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const beginConfirmation = (address, startCooldown = true, message = 'Enviamos um código de confirmação para seu email.') => {
    setConfirmationEmail(address);
    setOtp('');
    setError('');
    setNotice(message);
    setResendSeconds(startCooldown ? RESEND_COOLDOWN_SECONDS : 0);
  };

  const switchMode = next => {
    if (loading || verifyingOtp || resendLoading) return;
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmationEmail('');
    setOtp('');
    setResendSeconds(0);
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail || resendSeconds > 0 || resendLoading) return;
    setError('');
    setNotice('');
    setResendLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: confirmationEmail,
      });
      if (resendError) {
        setError(authErrorMessage(resendError, 'Não foi possível reenviar o código agora.'));
        if ((resendError.message?.toLowerCase() || '').includes('rate')) setResendSeconds(RESEND_COOLDOWN_SECONDS);
        return;
      }
      setNotice(`Novo código enviado para ${confirmationEmail}.`);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (resendError) {
      console.error('Auth confirmation resend failed:', resendError);
      setError(authErrorMessage(resendError, 'Não foi possível reenviar o código agora.'));
    } finally {
      setResendLoading(false);
    }
  };

  const verifyCode = async event => {
    event.preventDefault();
    if (verifyingOtp) return;
    const cleanOtp = otp.replace(/\D/g, '');
    if (cleanOtp.length < OTP_MIN_LENGTH || cleanOtp.length > OTP_MAX_LENGTH) {
      setError('Digite o código completo enviado para seu email.');
      return;
    }

    setError('');
    setNotice('');
    setVerifyingOtp(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: confirmationEmail,
        token: cleanOtp,
        type: 'email',
      });

      if (verifyError) {
        const message = verifyError.message?.toLowerCase() || '';
        if (message.includes('expired') || message.includes('invalid')) {
          setError('Não foi possível validar esse código. Ele pode estar inválido, expirado ou já ter sido usado. Solicite um novo código e tente novamente.');
        } else {
          setError(authErrorMessage(verifyError, 'Não foi possível confirmar esse código agora.'));
        }
        return;
      }

      if (data?.user) {
        onAuthenticated(data.user);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userData?.user) onAuthenticated(userData.user);
      else setError(authErrorMessage(userError, 'O código foi aceito, mas não conseguimos abrir sua sessão. Tente entrar novamente.'));
    } catch (verifyError) {
      console.error('Auth OTP verification failed:', verifyError);
      setError(authErrorMessage(verifyError, 'Não foi possível confirmar esse código agora.'));
    } finally {
      setVerifyingOtp(false);
    }
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
      if (signupError.message.toLowerCase().includes('registered')) {
        beginConfirmation(normalizedEmail, false, 'Essa conta já existe no backend. Se ainda não confirmou o email, solicite um novo código abaixo.');
      } else {
        setError(authErrorMessage(signupError, 'Não foi possível migrar sua conta agora.'));
      }
      return true;
    }

    if (data.session && data.user) onAuthenticated(data.user);
    else beginConfirmation(normalizedEmail, true, 'Sua conta antiga foi migrada. Digite o código enviado para confirmar o email.');
    return true;
  };

  const submit = async event => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Digite um email válido.');
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
        if (signupError) {
          setError(authErrorMessage(signupError, 'Não foi possível criar sua conta agora.'));
          return;
        }

        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError('Já existe uma conta com esse email. Use “Entrar”.');
          return;
        }

        if (data?.session && data?.user) {
          onAuthenticated(data.user);
          return;
        }

        if (data?.user) {
          const { data: immediateLogin, error: immediateLoginError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (!immediateLoginError && immediateLogin?.user) {
            onAuthenticated(immediateLogin.user);
            return;
          }

          const loginMessage = String(immediateLoginError?.message || '').toLowerCase();
          if (!loginMessage.includes('email not confirmed')) {
            setError(authErrorMessage(immediateLoginError, 'Sua conta foi criada, mas não conseguimos iniciar a sessão. Tente entrar novamente.'));
            return;
          }
        }

        beginConfirmation(normalizedEmail);
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (!loginError && data.user) {
        onAuthenticated(data.user);
        return;
      }

      if (loginError?.message?.toLowerCase().includes('email not confirmed')) {
        beginConfirmation(normalizedEmail, false, 'Seu email ainda não foi confirmado. Digite o código recebido ou solicite outro abaixo.');
        return;
      }

      const handledLegacy = await tryLegacyMigration(normalizedEmail, password);
      if (!handledLegacy) setError('Email ou senha incorretos.');
    } catch (submitError) {
      console.error('Auth submit failed:', submitError);
      setError(authErrorMessage(submitError, mode === 'register' ? 'Não foi possível criar sua conta agora.' : 'Não foi possível entrar agora.'));
    } finally {
      setLoading(false);
    }
  };

  if (confirmationEmail) {
    return (
      <div className="auth-overlay">
        <div className="auth-layout">
          <BrandPanel />
          <main className="auth-form-panel">
            <div className="auth-mobile-brand"><div className="auth-brand-mark"><MessageCircle size={21} /></div><span>Fuply</span></div>
            <section className="auth-card">
              <button
                type="button"
                onClick={() => { setConfirmationEmail(''); setOtp(''); setError(''); setNotice(''); setResendSeconds(0); }}
                style={{ border: 0, background: 'transparent', padding: 0, color: '#667085', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 22 }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>

              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eaf8f1', color: '#16a36a', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
                <Mail size={23} />
              </div>

              <div className="auth-card-heading">
                <h2>Confirme seu email</h2>
                <p>Enviamos um código de confirmação para <strong style={{ color: '#344054' }}>{confirmationEmail}</strong>.</p>
              </div>

              <form className="auth-form" onSubmit={verifyCode}>
                <label>
                  <span>Código de confirmação</span>
                  <div className="auth-input" style={{ height: 58, padding: '0 16px' }}>
                    <input
                      value={otp}
                      onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_MAX_LENGTH))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={OTP_MAX_LENGTH}
                      autoFocus
                      aria-label="Código de confirmação"
                      placeholder="00000000"
                      style={{ textAlign: 'center', fontSize: 25, fontWeight: 800, letterSpacing: 7, color: '#111827', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </label>

                {error && <div className="auth-error" role="alert">{error}</div>}
                {notice && <div className="auth-error" role="status" style={{ background: '#eefaf4', color: '#126b47', borderColor: '#cdebdc' }}>{notice}</div>}

                <button type="submit" className="auth-submit" disabled={verifyingOtp || otp.length < OTP_MIN_LENGTH || otp.length > OTP_MAX_LENGTH}>
                  {verifyingOtp ? 'Confirmando...' : 'Confirmar email'}
                  {!verifyingOtp && <ArrowRight size={17} />}
                </button>

                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resendLoading || resendSeconds > 0}
                  style={{ height: 40, border: '1px solid #cfe5da', borderRadius: 9, background: resendSeconds > 0 ? '#f3f6f5' : '#f5fbf8', color: resendSeconds > 0 ? '#8a9490' : '#0f7a50', fontWeight: 800, fontSize: 11, cursor: resendLoading || resendSeconds > 0 ? 'not-allowed' : 'pointer' }}
                >
                  {resendLoading ? 'Reenviando...' : resendSeconds > 0 ? `Reenviar código em ${resendSeconds}s` : 'Reenviar código'}
                </button>
              </form>

              <p className="auth-local-note">Não precisa clicar em nenhum link no email. Copie o código inteiro e confirme aqui mesmo.</p>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-layout">
        <BrandPanel />
        <main className="auth-form-panel">
          <div className="auth-mobile-brand"><div className="auth-brand-mark"><MessageCircle size={21} /></div><span>Fuply</span></div>
          <section className="auth-card">
            <div className="auth-tabs" role="tablist" aria-label="Acesso">
              <button className={mode === 'login' ? 'active' : ''} aria-selected={mode === 'login'} role="tab" onClick={() => switchMode('login')} type="button" disabled={loading}>Entrar</button>
              <button className={mode === 'register' ? 'active' : ''} aria-selected={mode === 'register'} role="tab" onClick={() => switchMode('register')} type="button" disabled={loading}>Criar conta</button>
            </div>
            <div className="auth-card-heading"><h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2><p>{mode === 'login' ? 'Entre para continuar suas negociações.' : 'Comece a organizar suas vendas em poucos passos.'}</p></div>
            <form className="auth-form" onSubmit={submit} noValidate>
              {mode === 'register' && <label><span>Nome</span><div className="auth-input"><UserRound size={17} /><input required value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" /></div></label>}
              <label><span>Email</span><div className="auth-input"><Mail size={17} /><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" /></div></label>
              <label><span>Senha</span><div className="auth-input"><LockKeyhole size={17} /><input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" className="auth-eye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              {notice && <div className="auth-error" role="status" style={{ background: '#eefaf4', color: '#126b47', borderColor: '#cdebdc' }}>{notice}</div>}
              <button type="submit" className="auth-submit" disabled={loading}>{loading ? (mode === 'register' ? 'Criando conta...' : 'Entrando...') : mode === 'login' ? 'Entrar no Fuply' : 'Criar conta'}{!loading && <ArrowRight size={17} />}</button>
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
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase.from('profiles').update({
        selling_type: selling,
        goal,
        start_mode: startMode,
        onboarding_completed: true,
      }).eq('id', user.id);
      if (updateError) {
        setError(authErrorMessage(updateError, 'Não foi possível concluir o onboarding agora.'));
        return;
      }
      onComplete();
    } catch (updateError) {
      console.error('Onboarding save failed:', updateError);
      setError(authErrorMessage(updateError, 'Não foi possível concluir o onboarding agora.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-overlay onboarding-overlay">
      <main className="onboarding-shell">
        <header className="onboarding-topbar"><div className="auth-brand compact"><div className="auth-brand-mark"><MessageCircle size={21} /></div><span>Fuply</span></div><div className="onboarding-progress-copy">Passo {step} de 3</div></header>
        <div className="onboarding-progress"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
        <section className="onboarding-card">
          {step === 1 && <><span className="onboarding-kicker">Pra começar</span><h1>Como você vende?</h1><p>Isso ajuda o Fuply a adaptar sua experiência sem jogar 47 configurações inúteis na sua cara.</p><div className="onboarding-options">{SELL_OPTIONS.map(option => { const Icon = option.icon; return <button type="button" key={option.id} className={selling === option.id ? 'selected' : ''} onClick={() => setSelling(option.id)}><div className="onboarding-option-icon"><Icon size={20} /></div><div><strong>{option.title}</strong><span>{option.text}</span></div>{selling === option.id && <Check className="onboarding-check" size={17} />}</button>; })}</div></>}
          {step === 2 && <><span className="onboarding-kicker">Seu foco</span><h1>Qual é seu principal objetivo?</h1><p>Escolha o problema que você mais quer parar de carregar na cabeça.</p><div className="onboarding-options">{GOAL_OPTIONS.map(option => { const Icon = option.icon; return <button type="button" key={option.id} className={goal === option.id ? 'selected' : ''} onClick={() => setGoal(option.id)}><div className="onboarding-option-icon"><Icon size={20} /></div><div><strong>{option.title}</strong><span>{option.text}</span></div>{goal === option.id && <Check className="onboarding-check" size={17} />}</button>; })}</div></>}
          {step === 3 && <><span className="onboarding-kicker">Último passo</span><h1>Como quer começar?</h1><p>Você pode explorar o Fuply com exemplos ou entrar com o sistema limpo.</p><div className="onboarding-start-grid"><button type="button" className={startMode === 'demo' ? 'selected' : ''} onClick={() => setStartMode('demo')}><div className="onboarding-option-icon"><Sparkles size={21} /></div><strong>Usar dados de exemplo</strong><span>Veja o pipeline, leads e follow-ups já preenchidos.</span>{startMode === 'demo' && <Check className="onboarding-check" size={17} />}</button><button type="button" className={startMode === 'empty' ? 'selected' : ''} onClick={() => setStartMode('empty')}><div className="onboarding-option-icon"><UsersRound size={21} /></div><strong>Começar vazio</strong><span>Entre sem contatos e adicione seu primeiro lead.</span>{startMode === 'empty' && <Check className="onboarding-check" size={17} />}</button></div></>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <footer className="onboarding-actions"><button type="button" className="onboarding-back" disabled={step === 1 || saving} onClick={() => setStep(value => Math.max(1, value - 1))}><ArrowLeft size={17} /> Voltar</button>{step < 3 ? <button type="button" className="onboarding-next" disabled={!canContinue || saving} onClick={() => setStep(value => Math.min(3, value + 1))}>Continuar <ArrowRight size={17} /></button> : <button type="button" className="onboarding-next" disabled={!canContinue || saving} onClick={finish}>{saving ? 'Salvando...' : 'Entrar no Fuply'} {!saving && <ArrowRight size={17} />}</button>}</footer>
        </section>
      </main>
    </div>
  );
}

function AuthFlow() {
  const [phase, setPhase] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState('');

  const resolveUser = async nextUser => {
    if (!nextUser) {
      setUser(null);
      setProfile(null);
      setProfileLoadError('');
      setPhase('auth');
      return;
    }
    try {
      const nextProfile = await getProfile(nextUser.id);
      setUser(nextUser);
      setProfile(nextProfile);
      setProfileLoadError('');
      setPhase(nextProfile?.onboarding_completed ? 'done' : 'onboarding');
    } catch (profileError) {
      console.error('Auth profile resolution failed:', profileError);
      setUser(nextUser);
      setProfileLoadError('Não foi possível carregar os dados da sua conta. Nenhuma configuração foi alterada.');
      setPhase('profile-error');
    }
  };

  useEffect(() => {
    let active = true;
    let authTimer = null;

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Initial auth lookup failed:', error);
          setProfileLoadError('Não foi possível verificar sua sessão agora.');
          setPhase('profile-error');
          return;
        }
        resolveUser(data.user || null);
      })
      .catch(initialError => {
        console.error('Initial auth lookup failed:', initialError);
        if (active) {
          setProfileLoadError('Não foi possível verificar sua sessão agora.');
          setPhase('profile-error');
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      window.clearTimeout(authTimer);
      authTimer = window.setTimeout(() => {
        if (active) resolveUser(nextUser);
      }, 0);
    });

    return () => {
      active = false;
      window.clearTimeout(authTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'done') document.body.classList.add('auth-locked');
    else document.body.classList.remove('auth-locked');
    return () => document.body.classList.remove('auth-locked');
  }, [phase]);

  if (phase === 'loading') return <div className="auth-overlay" />;
  if (phase === 'done') return null;
  if (phase === 'profile-error') return (
    <div className="auth-overlay" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
      <section style={{ width: 'min(460px, 100%)', background: '#fff', border: '1px solid #e4e8e6', borderRadius: 18, padding: 28, boxShadow: '0 16px 46px rgba(20,37,28,.10)' }}>
        <div className="auth-brand" style={{ marginBottom: 18 }}><div className="auth-brand-mark"><MessageCircle size={22} /></div><span>Fuply</span></div>
        <h1 style={{ margin: '0 0 8px', fontSize: 25 }}>Não foi possível carregar sua conta</h1>
        <p style={{ margin: '0 0 18px', color: '#66756d', lineHeight: 1.55 }}>{profileLoadError || 'O Fuply encontrou um problema temporário ao carregar sua sessão.'}</p>
        <button type="button" className="onboarding-next" onClick={() => user ? resolveUser(user) : window.location.reload()}>Tentar novamente <ArrowRight size={17} /></button>
      </section>
    </div>
  );
  if (phase === 'onboarding' && user) return <Onboarding user={user} profile={profile} onComplete={() => window.location.reload()} />;
  return <AuthScreen onAuthenticated={resolveUser} />;
}

const host = document.getElementById('auth-root');
const isPublicDemo = new URLSearchParams(window.location.search).get('demo') === 'jacob';
if (host && !isPublicDemo) createRoot(host).render(<AuthFlow />);
