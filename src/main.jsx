import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CHEF_DEMO_ACCOUNT, CHEF_DEMO_LEADS } from './chefDemoData';
import { getActiveAccount } from './accountStorage';
import './dark.css';
import './dark-integrated.css';
import './dark-command-fix.css';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();
const isDemo = new URLSearchParams(window.location.search).get('demo') === 'chef';

const initialTheme = !isDemo && activeAccount?.theme === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = initialTheme;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', initialTheme === 'dark' ? '#101318' : '#16A36A');

if (rootHost && isDemo) {
  // Demonstração: clientes inventados, nada é salvo no banco.
  createRoot(rootHost).render(
    <React.StrictMode>
      <App demoMode demoAccount={CHEF_DEMO_ACCOUNT} demoLeads={CHEF_DEMO_LEADS} />
    </React.StrictMode>,
  );
} else if (rootHost && activeAccount?.onboardingCompleted) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
