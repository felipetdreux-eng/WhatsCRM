import { supabase } from './supabaseClient';
import { getProfile, hydrateBackend, installSyncBridge } from './backendBridge';

async function boot() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return;

  try {
    const profile = await getProfile(data.user.id);
    if (!profile?.onboarding_completed) return;
    await hydrateBackend(data.user, profile);
    installSyncBridge(data.user.id);
    await import('./main.jsx');
  } catch (bootError) {
    console.error('ZapFlow backend boot failed:', bootError);
  }
}

boot();
