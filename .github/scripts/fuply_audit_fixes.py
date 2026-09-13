from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:160]}')
    p.write_text(text.replace(old, new, count))


replace(
    'src/AuthFlow.jsx',
    """  const [phase, setPhase] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
""",
    """  const [phase, setPhase] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState('');
""",
)

replace(
    'src/AuthFlow.jsx',
    """    if (!nextUser) {
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
    } catch (profileError) {
      console.error('Auth profile resolution failed:', profileError);
      setUser(nextUser);
      setProfile(null);
      setPhase('onboarding');
    }
""",
    """    if (!nextUser) {
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
""",
)

replace(
    'src/AuthFlow.jsx',
    """        if (error) {
          console.error('Initial auth lookup failed:', error);
          setPhase('auth');
          return;
        }
""",
    """        if (error) {
          console.error('Initial auth lookup failed:', error);
          setProfileLoadError('Não foi possível verificar sua sessão agora.');
          setPhase('profile-error');
          return;
        }
""",
)

replace(
    'src/AuthFlow.jsx',
    """      .catch(initialError => {
        console.error('Initial auth lookup failed:', initialError);
        if (active) setPhase('auth');
      });
""",
    """      .catch(initialError => {
        console.error('Initial auth lookup failed:', initialError);
        if (active) {
          setProfileLoadError('Não foi possível verificar sua sessão agora.');
          setPhase('profile-error');
        }
      });
""",
)

replace(
    'src/AuthFlow.jsx',
    """  if (phase === 'loading') return <div className=\"auth-overlay\" />;
  if (phase === 'done') return null;
  if (phase === 'onboarding' && user) return <Onboarding user={user} profile={profile} onComplete={() => window.location.reload()} />;
  return <AuthScreen onAuthenticated={resolveUser} />;
""",
    """  if (phase === 'loading') return <div className=\"auth-overlay\" />;
  if (phase === 'done') return null;
  if (phase === 'profile-error') return (
    <div className=\"auth-overlay\" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
      <section style={{ width: 'min(460px, 100%)', background: '#fff', border: '1px solid #e4e8e6', borderRadius: 18, padding: 28, boxShadow: '0 16px 46px rgba(20,37,28,.10)' }}>
        <div className=\"auth-brand\" style={{ marginBottom: 18 }}><div className=\"auth-brand-mark\"><MessageCircle size={22} /></div><span>Fuply</span></div>
        <h1 style={{ margin: '0 0 8px', fontSize: 25 }}>Não foi possível carregar sua conta</h1>
        <p style={{ margin: '0 0 18px', color: '#66756d', lineHeight: 1.55 }}>{profileLoadError || 'O Fuply encontrou um problema temporário ao carregar sua sessão.'}</p>
        <button type=\"button\" className=\"onboarding-next\" onClick={() => user ? resolveUser(user) : window.location.reload()}>Tentar novamente <ArrowRight size={17} /></button>
      </section>
    </div>
  );
  if (phase === 'onboarding' && user) return <Onboarding user={user} profile={profile} onComplete={() => window.location.reload()} />;
  return <AuthScreen onAuthenticated={resolveUser} />;
""",
)
