import { supabase } from './supabaseClient';

const ACCOUNTS_KEY = 'zapflow-accounts';
const SESSION_KEY = 'zapflow-session';
const OWNER_KEY = 'zapflow-storage-owner';
const ID_MAP_KEY_PREFIX = 'zapflow-lead-id-map';

const readJSON = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

function legacyAccountFor(email, userId) {
  const accounts = readJSON(ACCOUNTS_KEY, []);
  if (!Array.isArray(accounts)) return null;
  return accounts.find(account => account.id !== userId && String(account.email || '').toLowerCase() === String(email || '').toLowerCase()) || null;
}

function legacyData(base, legacyAccountId) {
  if (!legacyAccountId) return null;
  const scopedKey = `${base}:${legacyAccountId}`;
  if (localStorage.getItem(scopedKey) !== null) return readJSON(scopedKey, null);
  if (localStorage.getItem(OWNER_KEY) === legacyAccountId) return readJSON(base, null);
  return null;
}

function loadIdMap(userId) {
  const map = readJSON(`${ID_MAP_KEY_PREFIX}:${userId}`, {});
  return map && typeof map === 'object' ? map : {};
}

function stableLeadId(leadId, userId, idMap) {
  if (isUuid(leadId)) return leadId;
  const key = String(leadId || crypto.randomUUID());
  if (!idMap[key]) idMap[key] = crypto.randomUUID();
  localStorage.setItem(`${ID_MAP_KEY_PREFIX}:${userId}`, JSON.stringify(idMap));
  return idMap[key];
}

function toDbLead(lead, userId, idMap) {
  const sold = lead.status === 'Vendido';
  const saleValue = sold ? Number(lead.saleValue ?? lead.value ?? 0) : null;
  return {
    id: stableLeadId(lead.id, userId, idMap),
    user_id: userId,
    name: String(lead.name || '').trim() || 'Lead sem nome',
    company: String(lead.company || ''),
    phone: String(lead.phone || '').replace(/\D/g, ''),
    value: Number(lead.value || 0),
    sale_value: sold && saleValue > 0 ? saleValue : null,
    sale_value_source: sold ? (lead.saleValueSource || 'confirmed') : null,
    status: lead.status || 'Novo lead',
    origin: lead.origin || 'Outro',
    notes: lead.notes || '',
    next_contact: lead.nextContact || null,
    next_contact_time: lead.nextContactTime || null,
    next_action: lead.nextAction || '',
    last_followup_at: lead.lastFollowupAt || null,
    sold_at: lead.soldAt || null,
    lost_at: lead.lostAt || null,
    created_at: lead.createdAt || new Date().toISOString(),
    updated_at: lead.updatedAt || new Date().toISOString(),
  };
}

function fromDbLead(row) {
  return {
    id: row.id,
    name: row.name,
    company: row.company || '',
    phone: row.phone || '',
    value: Number(row.value || 0),
    saleValue: row.sale_value == null ? null : Number(row.sale_value),
    saleValueSource: row.sale_value_source || null,
    status: row.status,
    origin: row.origin,
    notes: row.notes || '',
    nextContact: row.next_contact || '',
    nextContactTime: row.next_contact_time ? String(row.next_contact_time).slice(0, 5) : '',
    nextAction: row.next_action || '',
    lastFollowupAt: row.last_followup_at || null,
    soldAt: row.sold_at || null,
    lostAt: row.lost_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function fromDbMessage(row) {
  return {
    id: row.template_key || row.id,
    title: row.title || 'Mensagem',
    category: row.category || '',
    text: row.text || '',
  };
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('id,name,selling_type,goal,start_mode,onboarding_completed').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export function mirrorAccount(user, profile) {
  const accounts = readJSON(ACCOUNTS_KEY, []);
  const legacy = legacyAccountFor(user.email, user.id);
  const onboarding = profile?.onboarding_completed ? {
    selling: profile.selling_type || '',
    goal: profile.goal || '',
    startMode: profile.start_mode || 'demo',
  } : null;
  const account = {
    id: user.id,
    name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    createdAt: user.created_at || new Date().toISOString(),
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    onboarding,
    backend: 'supabase',
  };
  const next = Array.isArray(accounts) ? accounts.filter(item => item.id !== user.id) : [];
  next.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: user.id, email: user.email, backend: 'supabase' }));
  localStorage.setItem(OWNER_KEY, user.id);
  if (legacy) localStorage.setItem(`zapflow-legacy-account:${user.id}`, legacy.id);
  return account;
}

export async function loadLeads(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from('leads').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDbLead);
}

export async function syncLeads(leads, userId) {
  if (!Array.isArray(leads) || !userId) return [];
  const idMap = loadIdMap(userId);
  const rows = leads.map(lead => toDbLead(lead, userId, idMap)).filter(row => row.status !== 'Vendido' || Number(row.sale_value) > 0);
  if (!rows.length) return [];
  const { data, error } = await supabase.from('leads').upsert(rows, { onConflict: 'id' }).select();
  if (error) throw error;
  return (data || []).map(fromDbLead);
}

export async function loadMessages(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from('message_templates').select('*').eq('user_id', userId).order('created_at');
  if (error) throw error;
  return (data || []).map(fromDbMessage);
}

export async function syncMessages(templates, userId) {
  if (!Array.isArray(templates) || !userId) return [];
  const rows = templates.map(template => ({
    user_id: userId,
    template_key: String(template.id || template.title),
    title: template.title || 'Mensagem',
    category: template.category || '',
    text: template.text || '',
  })).filter(row => row.text.trim());
  if (!rows.length) return [];
  const { data, error } = await supabase.from('message_templates').upsert(rows, { onConflict: 'user_id,template_key' }).select();
  if (error) throw error;
  return (data || []).map(fromDbMessage);
}

export async function hydrateBackend(user, profile) {
  mirrorAccount(user, profile);
  const legacyId = localStorage.getItem(`zapflow-legacy-account:${user.id}`) || legacyAccountFor(user.email, user.id)?.id;

  const dbLeads = await loadLeads(user.id);

  if (dbLeads.length) {
    localStorage.setItem('zapflow-leads', JSON.stringify(dbLeads));
  } else {
    const oldLeads = legacyData('zapflow-leads', legacyId);
    if (Array.isArray(oldLeads) && oldLeads.length) {
      const migrated = await syncLeads(oldLeads, user.id);
      localStorage.setItem('zapflow-leads', JSON.stringify(migrated.length ? migrated : oldLeads));
    } else if (profile?.start_mode === 'empty') {
      localStorage.setItem('zapflow-leads', '[]');
    } else {
      localStorage.removeItem('zapflow-leads');
    }
  }

  const dbMessages = await loadMessages(user.id);
  if (!dbMessages.length) {
    const oldMessages = legacyData('zapflow-messages', legacyId);
    if (Array.isArray(oldMessages) && oldMessages.length) await syncMessages(oldMessages, user.id);
  }
}

export function installSyncBridge(userId) {
  if (window.__zapflowSyncBridgeInstalled) return;
  window.__zapflowSyncBridgeInstalled = true;
  const originalSetItem = Storage.prototype.setItem;
  let leadTimer;

  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage) return;
    if (key === 'zapflow-leads') {
      clearTimeout(leadTimer);
      leadTimer = setTimeout(() => {
        try { syncLeads(JSON.parse(value), userId).catch(console.error); } catch {}
      }, 180);
    }
  };

  window.__zapflowSupabaseSignOut = () => supabase.auth.signOut({ scope: 'local' });
}
