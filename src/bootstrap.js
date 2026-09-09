import { getActiveAccount } from './accountStorage';

const account = getActiveAccount();

if (account?.onboardingCompleted) {
  const accountId = account.id;

  window.addEventListener('storage', event => {
    if (event.key !== 'zapflow-session') return;
    const nextAccount = getActiveAccount();
    if (nextAccount?.id !== accountId) window.location.reload();
  });

  import('./main.jsx');
}
