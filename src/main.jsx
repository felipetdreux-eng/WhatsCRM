import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import JacobDemo from './JacobDemo';
import GlobalImportDrop from './GlobalImportDrop';
import { getActiveAccount } from './accountStorage';
import './pipelineDragScroll';
import './dark.css';
import './dark-integrated.css';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();
const demo = new URLSearchParams(window.location.search).get('demo');
const isJacobDemo = demo === 'jacob';

document.documentElement.dataset.theme = isJacobDemo ? 'light' : (activeAccount?.theme === 'dark' ? 'dark' : 'light');

if (rootHost && isJacobDemo) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <JacobDemo />
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
