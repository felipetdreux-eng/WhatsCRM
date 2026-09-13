import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GlobalImportDrop from './GlobalImportDrop';
import { JACOB_DEMO_ACCESS, JACOB_DEMO_ACCOUNT, JACOB_DEMO_LEADS, JACOB_DEMO_TEAM, JACOB_DEMO_WHATSAPP } from './jacobDemoData';
import { getActiveAccount } from './accountStorage';
import './pipelineDragScroll';
import './dark.css';
import './dark-integrated.css';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();
const params = new URLSearchParams(window.location.search);
const demo = params.get('demo');
const demoToken = params.get('token');
const isJacobDemo = demo === 'jacob';
const hasJacobToken = demoToken === JACOB_DEMO_ACCESS.token;
const jacobDemoExpired = Date.now() >= new Date(JACOB_DEMO_ACCESS.expiresAt).getTime();
const jacobDemoAllowed = isJacobDemo && hasJacobToken && !jacobDemoExpired;

document.documentElement.dataset.theme = isJacobDemo ? JACOB_DEMO_ACCOUNT.theme : (activeAccount?.theme === 'dark' ? 'dark' : 'light');

function DemoUnavailable({ expired }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5f7f6', color: '#17211c', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(520px, 100%)', background: '#fff', border: '1px solid #e1e7e3', borderRadius: 18, padding: 30, boxShadow: '0 12px 40px rgba(20,37,28,.08)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#eaf7f0', color: '#16885a', fontWeight: 900, marginBottom: 18 }}>F</div>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-.04em' }}>{expired ? 'Demonstração encerrada' : 'Link de demonstração inválido'}</h1>
        <p style={{ margin: '10px 0 0', color: '#66756d', lineHeight: 1.6 }}>{expired ? 'O período de teste deste acesso terminou. Para continuar usando o Fuply, é necessário ativar uma conta.' : 'Este acesso não possui um token válido. Solicite um novo link de demonstração.'}</p>
      </section>
    </main>
  );
}

if (rootHost && isJacobDemo && !jacobDemoAllowed) {
  createRoot(rootHost).render(<DemoUnavailable expired={jacobDemoExpired} />);
} else if (rootHost && jacobDemoAllowed) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <App demoMode demoAccount={JACOB_DEMO_ACCOUNT} demoLeads={JACOB_DEMO_LEADS} demoTeamMembers={JACOB_DEMO_TEAM} demoWhatsAppPhone={JACOB_DEMO_WHATSAPP} />
    </React.StrictMode>,
  );
} else if (rootHost && activeAccount?.onboardingCompleted) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <App />
      <GlobalImportDrop />
    </React.StrictMode>,
  );
}
