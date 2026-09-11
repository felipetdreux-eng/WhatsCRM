import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GlobalImportDrop from './GlobalImportDrop';
import { getActiveAccount } from './accountStorage';
import './pipelineDragScroll';
import './dark.css';
import './dark-integrated.css';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();
document.documentElement.dataset.theme = activeAccount?.theme === 'dark' ? 'dark' : 'light';

if (rootHost && activeAccount?.onboardingCompleted) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <App />
      <GlobalImportDrop />
    </React.StrictMode>,
  );
}
