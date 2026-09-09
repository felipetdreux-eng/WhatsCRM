import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GlobalImportDrop from './GlobalImportDrop';
import { getActiveAccount } from './accountStorage';

const rootHost = document.getElementById('root');
const activeAccount = getActiveAccount();

if (rootHost && activeAccount?.onboardingCompleted) {
  createRoot(rootHost).render(
    <React.StrictMode>
      <App />
      <GlobalImportDrop />
    </React.StrictMode>,
  );
}
