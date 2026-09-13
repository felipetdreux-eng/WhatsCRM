import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GlobalImportDrop from './GlobalImportDrop';
import { JACOB_DEMO_ACCOUNT, JACOB_DEMO_LEADS, JACOB_DEMO_TEAM, JACOB_DEMO_WHATSAPP } from './jacobDemoData';
import { getActiveAccount } from './accountStorage';
import './pipelineDragScroll';
import './dark.css';
import './dark-integrated.css';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();
const demo = new URLSearchParams(window.location.search).get('demo');
const isJacobDemo = demo === 'jacob';

document.documentElement.dataset.theme = isJacobDemo ? JACOB_DEMO_ACCOUNT.theme : (activeAccount?.theme === 'dark' ? 'dark' : 'light');

if (rootHost && isJacobDemo) {
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
