import { supabase } from './supabaseClient';
import { getProfile, hydrateBackend, installSyncBridge } from './backendBridge';

let bootPromise = null;
let bootedUserId = null;

async function boot(sessionUser = null) {
  const user = sessionUser || (await supabase.auth.getUser()).data?.user || null;
  if (!user) return;
  if (bootedUserId === user.id) return;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    try {
      const profile = await getProfile(user.id);
      if (!profile?.onboarding_completed) return;

      await hydrateBackend(user, profile);
      installSyncBridge(user.id);
      await import('./main.jsx');
      bootedUserId = user.id;
    } catch (bootError) {
      console.error('Fuply backend boot failed:', bootError);
    } finally {
      bootPromise = null;
    }
  })();

  return bootPromise;
}

boot().catch(bootError => console.error('Fuply initial boot failed:', bootError));

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    bootedUserId = null;
    return;
  }

  if (session?.user && ['SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED'].includes(event)) {
    window.setTimeout(() => {
      boot(session.user).catch(bootError => console.error('Fuply auth boot failed:', bootError));
    }, 0);
  }
});
