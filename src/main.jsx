import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GlobalImportDrop from './GlobalImportDrop';
import { JACOB_DEMO_ACCOUNT, JACOB_DEMO_LEADS, JACOB_DEMO_TEAM, JACOB_DEMO_WHATSAPP } from './jacobDemoData';
import { ABLE_DEMO_ACCOUNT, ABLE_DEMO_LEADS, ABLE_DEMO_TEAM, ABLE_DEMO_WHATSAPP } from './ableLiveDemoData';
import { INNOVA_DEMO_ACCOUNT, INNOVA_DEMO_LEADS, INNOVA_DEMO_TEAM, INNOVA_DEMO_WHATSAPP } from './innovaDemoData';
import { getActiveAccount } from './accountStorage';
import './pipelineDragScroll';
import './dark.css';
import './dark-integrated.css';
import './dark-command-fix.css';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();
const params = new URLSearchParams(window.location.search);
const demo = params.get('demo');
const demoToken = params.get('token');
const isJacobDemo = demo === 'jacob';
const isAbleDemo = demo === 'able' || demo === 'able-live';
const isInnovaDemo = demo === 'innova' || demo === 'innova-automation';

const demoTheme = isJacobDemo
  ? JACOB_DEMO_ACCOUNT.theme
  : isAbleDemo
    ? ABLE_DEMO_ACCOUNT.theme
    : isInnovaDemo
      ? INNOVA_DEMO_ACCOUNT.theme
      : null;

document.documentElement.dataset.theme = demoTheme || (activeAccount?.theme === 'dark' ? 'dark' : 'light');

function DemoStatus({ title, text }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5f7f6', color: '#17211c', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(520px, 100%)', background: '#fff', border: '1px solid #e1e7e3', borderRadius: 18, padding: 30, boxShadow: '0 12px 40px rgba(20,37,28,.08)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#eaf7f0', color: '#16885a', fontWeight: 900, marginBottom: 18 }}>F</div>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-.04em' }}>{title}</h1>
        <p style={{ margin: '10px 0 0', color: '#66756d', lineHeight: 1.6 }}>{text}</p>
      </section>
    </main>
  );
}

function renderAbleDemo() {
  if (!rootHost) return;
  createRoot(rootHost).render(
    <React.StrictMode>
      <App
        demoMode
        demoAccount={ABLE_DEMO_ACCOUNT}
        demoLeads={ABLE_DEMO_LEADS}
        demoTeamMembers={ABLE_DEMO_TEAM}
        demoWhatsAppPhone={ABLE_DEMO_WHATSAPP}
      />
    </React.StrictMode>,
  );
}

async function renderProtectedDemo({ demoKey, account, leads, team, whatsapp }) {
  if (!rootHost) return;
  const root = createRoot(rootHost);
  root.render(<DemoStatus title="Carregando demonstração" text="Validando este acesso temporário ao Fuply…" />);

  try {
    const response = await fetch(`/api/demo-access?demo=${encodeURIComponent(demoKey)}&token=${encodeURIComponent(demoToken || '')}`, { cache: 'no-store' });
    const access = response.ok ? await response.json() : null;

    if (!access?.allowed) {
      root.render(access?.expired
        ? <DemoStatus title="Demonstração encerrada" text="O período de acesso desta demonstração terminou. Para continuar usando o Fuply, é necessário solicitar um novo acesso." />
        : <DemoStatus title="Link de demonstração inválido" text="Este acesso não possui um token válido. Solicite um novo link de demonstração." />);
      return;
    }

    root.render(
      <React.StrictMode>
        <App demoMode demoAccount={account} demoLeads={leads} demoTeamMembers={team} demoWhatsAppPhone={whatsapp} />
      </React.StrictMode>,
    );

    const expiresInMs = Math.max(0, Number(access.expiresInMs || 0));
    if (expiresInMs > 0) {
      window.setTimeout(() => {
        root.render(<DemoStatus title="Demonstração encerrada" text="O período de acesso desta demonstração terminou. Para continuar usando o Fuply, é necessário solicitar um novo acesso." />);
      }, Math.min(expiresInMs, 2147483647));
    }
  } catch (error) {
    console.error('Demo access validation failed:', error);
    root.render(<DemoStatus title="Não foi possível validar a demonstração" text="Tente abrir o link novamente. Se o problema continuar, solicite um novo acesso." />);
  }
}

if (rootHost && isInnovaDemo) {
  renderProtectedDemo({
    demoKey: 'innova',
    account: INNOVA_DEMO_ACCOUNT,
    leads: INNOVA_DEMO_LEADS,
    team: INNOVA_DEMO_TEAM,
    whatsapp: INNOVA_DEMO_WHATSAPP,
  });
} else if (rootHost && isAbleDemo) {
  renderAbleDemo();
} else if (rootHost && isJacobDemo) {
  renderProtectedDemo({
    demoKey: 'jacob',
    account: JACOB_DEMO_ACCOUNT,
    leads: JACOB_DEMO_LEADS,
    team: JACOB_DEMO_TEAM,
    whatsapp: JACOB_DEMO_WHATSAPP,
  });
} else if (rootHost && activeAccount?.onboardingCompleted) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <App />
      <GlobalImportDrop />
    </React.StrictMode>,
  );
}
