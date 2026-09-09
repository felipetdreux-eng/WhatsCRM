export const ACCOUNTS_KEY = 'zapflow-accounts';
export const SESSION_KEY = 'zapflow-session';

const OWNER_KEY = 'zapflow-storage-owner';
const LEGACY_BACKUP_PREFIX = 'zapflow-legacy-backup';
const SCOPED_BASES = ['zapflow-leads', 'zapflow-messages'];
const SUPABASE_SESSION_KEY = 'sb-myllrhcgbrwfvtqxgkcb-auth-token';

export function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function scopedKey(base, accountId) {
  return `${base}:${accountId}`;
}

export function getActiveAccount() {
  const accounts = readJSON(ACCOUNTS_KEY, []);
  const session = readJSON(SESSION_KEY, null);
  if (!session?.accountId || !Array.isArray(accounts)) return null;
  return accounts.find(account => account.id === session.accountId) || null;
}

function saveGlobalToAccount(accountId) {
  if (!accountId) return;
  for (const base of SCOPED_BASES) {
    const value = localStorage.getItem(base);
    const target = scopedKey(base, accountId);
    if (value === null) localStorage.removeItem(target);
    else localStorage.setItem(target, value);
  }
}

function archiveUnclaimedLegacy() {
  for (const base of SCOPED_BASES) {
    const value = localStorage.getItem(base);
    if (value === null) continue;
    const backupKey = `${LEGACY_BACKUP_PREFIX}:${base}`;
    if (localStorage.getItem(backupKey) === null) localStorage.setItem(backupKey, value);
  }
}

export function activateAccountStorage(accountId, { allowLegacy = true } = {}) {
  if (!accountId) return;
  const currentOwner = localStorage.getItem(OWNER_KEY);
  if (currentOwner === accountId) {
    saveGlobalToAccount(accountId);
    return;
  }
  if (currentOwner && currentOwner !== accountId) saveGlobalToAccount(currentOwner);
  if (!currentOwner) {
    const hasScopedData = SCOPED_BASES.some(base => localStorage.getItem(scopedKey(base, accountId)) !== null);
    const hasLegacyData = SCOPED_BASES.some(base => localStorage.getItem(base) !== null);
    if (!hasScopedData && hasLegacyData && allowLegacy) saveGlobalToAccount(accountId);
    else if (hasLegacyData && !allowLegacy) archiveUnclaimedLegacy();
  }
  for (const base of SCOPED_BASES) {
    const value = localStorage.getItem(scopedKey(base, accountId));
    if (value === null) localStorage.removeItem(base);
    else localStorage.setItem(base, value);
  }
  localStorage.setItem(OWNER_KEY, accountId);
}

export function initializeAccountData(accountId, startMode) {
  if (!accountId) return;
  const leadsKey = scopedKey('zapflow-leads', accountId);
  if (startMode === 'empty') localStorage.setItem(leadsKey, '[]');
  else localStorage.removeItem(leadsKey);
}

export async function logoutAccount(accountId) {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner === accountId) saveGlobalToAccount(accountId);

  try {
    await window.__zapflowSupabaseSignOut?.();
  } catch (error) {
    console.error('Supabase sign out failed:', error);
  }

  localStorage.removeItem(SUPABASE_SESSION_KEY);
  for (const base of SCOPED_BASES) localStorage.removeItem(base);
  localStorage.removeItem(OWNER_KEY);
  localStorage.removeItem(SESSION_KEY);
}
