import { supabase } from './supabaseClient';

const ACCOUNTS_KEY = 'zapflow-accounts';
const SESSION_KEY = 'zapflow-session';
const OWNER_KEY = 'zapflow-storage-owner';
const ID_MAP_KEY_PREFIX = 'zapflow-lead-id-map';
const THEME_KEY = 'zapflow-theme';
const workspaceCache = new Map();

const readJSON = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

export function applyAppTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', nextTheme === 'dark' ? '#101318' : '#16A36A');
  return nextTheme;
}

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

async function resolveActiveWorkspaceId(userId) {
  if (!userId) return null;
  if (workspaceCache.has(userId)) return workspaceCache.get(userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('active_workspace_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const workspaceId = data?.active_workspace_id || null;
  workspaceCache.set(userId, workspaceId);
  return workspaceId;
}

function toDbLead(lead, userId, idMap, workspaceId) {
  const sold = lead.status === 'Fechado';
  const saleValue = sold ? Number(lead.saleValue ?? lead.value ?? 0) : null;
  return {
    id: stableLeadId(lead.id, userId, idMap),
    user_id: userId,
    workspace_id: workspaceId,
    assigned_to: lead.assignedTo || userId,
    last_modified_by: userId,
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
    workspaceId: row.workspace_id || null,
    assignedTo: row.assigned_to || null,
    createdBy: row.user_id || null,
    lastModifiedBy: row.last_modified_by || null,
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

function fromDbActivity(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    actorId: row.user_id || null,
    kind: row.kind,
    title: row.title,
    detail: row.detail || '',
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at,
  };
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,selling_type,goal,start_mode,onboarding_completed,tutorial_completed,theme,active_workspace_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  workspaceCache.set(userId, data?.active_workspace_id || null);
  return data;
}

export async function updateProfileName(userId, name) {
  const cleanName = String(name || '').trim();
  if (!userId || cleanName.length < 2) throw new Error('Nome inválido.');

  const { data, error } = await supabase
    .from('profiles')
    .update({ name: cleanName })
    .eq('id', userId)
    .select('id,name,selling_type,goal,start_mode,onboarding_completed,tutorial_completed,theme,active_workspace_id')
    .single();
  if (error) throw error;

  const accounts = readJSON(ACCOUNTS_KEY, []);
  if (Array.isArray(accounts)) {
    const next = accounts.map(account => account.id === userId ? { ...account, name: cleanName } : account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  }

  return data;
}

export async function updateProfileTheme(userId, theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  if (!userId) throw new Error('Conta inválida.');

  const { data, error } = await supabase
    .from('profiles')
    .update({ theme: nextTheme })
    .eq('id', userId)
    .select('id,theme')
    .single();
  if (error) throw error;

  applyAppTheme(nextTheme);
  const accounts = readJSON(ACCOUNTS_KEY, []);
  if (Array.isArray(accounts)) {
    const next = accounts.map(account => account.id === userId ? { ...account, theme: nextTheme } : account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  }
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
  const theme = applyAppTheme(profile?.theme || localStorage.getItem(THEME_KEY) || 'light');
  const account = {
    id: user.id,
    name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    createdAt: user.created_at || new Date().toISOString(),
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    tutorialCompleted: Boolean(profile?.tutorial_completed),
    onboarding,
    theme,
    activeWorkspaceId: profile?.active_workspace_id || null,
    backend: 'supabase',
  };
  workspaceCache.set(user.id, account.activeWorkspaceId);
  const next = Array.isArray(accounts) ? accounts.filter(item => item.id !== user.id) : [];
  next.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: user.id, email: user.email, backend: 'supabase' }));
  localStorage.setItem(OWNER_KEY, user.id);
  if (legacy) localStorage.setItem(`zapflow-legacy-account:${user.id}`, legacy.id);
  return account;
}

export async function loadWorkspaceContext(userId) {
  if (!userId) return { activeWorkspace: null, workspaces: [], members: [], myRole: null };
  const profile = await getProfile(userId);

  const { data: ownMemberships, error: membershipsError } = await supabase
    .from('workspace_members')
    .select('workspace_id,user_id,role,joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (membershipsError) throw membershipsError;

  const workspaceIds = (ownMemberships || []).map(item => item.workspace_id);
  if (!workspaceIds.length) return { activeWorkspace: null, workspaces: [], members: [], myRole: null };

  const { data: workspaceRows, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id,name,owner_id,created_at,updated_at')
    .in('id', workspaceIds)
    .order('created_at', { ascending: true });
  if (workspaceError) throw workspaceError;

  const activeId = workspaceIds.includes(profile?.active_workspace_id) ? profile.active_workspace_id : workspaceIds[0];
  workspaceCache.set(userId, activeId);
  const activeWorkspace = (workspaceRows || []).find(item => item.id === activeId) || null;

  const { data: memberRows, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id,user_id,role,joined_at')
    .eq('workspace_id', activeId)
    .order('joined_at', { ascending: true });
  if (memberError) throw memberError;

  const memberIds = (memberRows || []).map(item => item.user_id);
  let profileRows = [];
  if (memberIds.length) {
    const { data, error } = await supabase.from('profiles').select('id,name').in('id', memberIds);
    if (error) throw error;
    profileRows = data || [];
  }
  const names = new Map(profileRows.map(item => [item.id, item.name || 'Membro']));
  const members = (memberRows || []).map(item => ({
    ...item,
    name: names.get(item.user_id) || (item.user_id === userId ? 'Você' : 'Membro'),
  }));
  const myRole = members.find(item => item.user_id === userId)?.role || null;

  return { activeWorkspace, workspaces: workspaceRows || [], members, myRole };
}

export async function createWorkspaceInvite(workspaceId) {
  if (!workspaceId) throw new Error('Equipe inválida.');
  const { data, error } = await supabase.rpc('create_workspace_invite', { _workspace_id: workspaceId });
  if (error) throw error;
  return data;
}

export async function joinWorkspaceByCode(userId, code) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!userId || cleanCode.length < 6) throw new Error('Código de convite inválido.');
  const { data, error } = await supabase.rpc('join_workspace_by_code', { _code: cleanCode });
  if (error) throw error;
  workspaceCache.set(userId, data || null);
  return data;
}

export async function setActiveWorkspace(userId, workspaceId) {
  if (!userId || !workspaceId) throw new Error('Equipe inválida.');
  const { error } = await supabase.rpc('set_active_workspace', { _workspace_id: workspaceId });
  if (error) throw error;
  workspaceCache.set(userId, workspaceId);
}

export async function renameWorkspace(workspaceId, name) {
  const cleanName = String(name || '').trim();
  if (!workspaceId || cleanName.length < 2) throw new Error('Nome de equipe inválido.');
  const { data, error } = await supabase
    .from('workspaces')
    .update({ name: cleanName })
    .eq('id', workspaceId)
    .select('id,name,owner_id,created_at,updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function removeWorkspaceMember(workspaceId, memberUserId) {
  if (!workspaceId || !memberUserId) throw new Error('Membro inválido.');
  const { data, error } = await supabase.rpc('remove_workspace_member', {
    _workspace_id: workspaceId,
    _user_id: memberUserId,
  });
  if (error) throw error;
  if (data !== true) throw new Error('A pessoa não foi removida.');
  return true;
}

export async function loadLeads(userId) {
  if (!userId) return [];
  const workspaceId = await resolveActiveWorkspaceId(userId);
  if (!workspaceId) return [];
  const { data, error } = await supabase.from('leads').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDbLead);
}

export async function syncLeads(leads, userId) {
  if (!Array.isArray(leads) || !userId) return [];
  const workspaceId = await resolveActiveWorkspaceId(userId);
  if (!workspaceId) return [];
  const idMap = loadIdMap(userId);
  const rows = leads.map(lead => toDbLead(lead, userId, idMap, workspaceId)).filter(row => row.status !== 'Fechado' || Number(row.sale_value) > 0);
  if (!rows.length) return [];
  const { data, error } = await supabase.from('leads').upsert(rows, { onConflict: 'id' }).select();
  if (error) throw error;
  return (data || []).map(fromDbLead);
}

export async function loadLeadActivities(userId, leadId, limit = 50) {
  if (!userId || !isUuid(leadId)) return [];
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const { data, error } = await supabase
    .from('lead_activities')
    .select('id,user_id,lead_id,kind,title,detail,metadata,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return (data || []).map(fromDbActivity);
}

export async function recordLeadActivity({ userId, leadId, kind, title, detail = '', metadata = {} }) {
  if (!userId || !isUuid(leadId) || !kind || !title) return null;
  const row = {
    user_id: userId,
    lead_id: leadId,
    kind,
    title: String(title).trim(),
    detail: String(detail || '').trim(),
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  };
  const { data, error } = await supabase
    .from('lead_activities')
    .insert(row)
    .select('id,user_id,lead_id,kind,title,detail,metadata,created_at')
    .single();
  if (error) throw error;
  return fromDbActivity(data);
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
  workspaceCache.set(user.id, profile?.active_workspace_id || null);
  const legacyId = localStorage.getItem(`zapflow-legacy-account:${user.id}`) || legacyAccountFor(user.email, user.id)?.id;

  const dbLeads = await loadLeads(user.id);

  if (dbLeads.length) {
    localStorage.setItem('zapflow-leads', JSON.stringify(dbLeads));
  } else {
    const oldLeads = legacyData('zapflow-leads', legacyId);
    if (Array.isArray(oldLeads) && oldLeads.length) {
      const migrated = await syncLeads(oldLeads, user.id);
      localStorage.setItem('zapflow-leads', JSON.stringify(migrated.length ? migrated : oldLeads));
    } else {
      // Demo data is created during onboarding. Never resurrect it on login,
      // especially in a shared workspace that was intentionally emptied.
      localStorage.setItem('zapflow-leads', '[]');
    }
  }

  const dbMessages = await loadMessages(user.id);
  if (!dbMessages.length) {
    const oldMessages = legacyData('zapflow-messages', legacyId);
    if (Array.isArray(oldMessages) && oldMessages.length) await syncMessages(oldMessages, user.id);
  }
}

function leadFingerprint(lead) {
  return JSON.stringify(lead || {});
}

export function installSyncBridge(userId) {
  if (window.__zapflowSyncBridgeInstalled) return;
  window.__zapflowSyncBridgeInstalled = true;
  const originalSetItem = Storage.prototype.setItem;
  let leadTimer;
  let lastSnapshot = new Map((readJSON('zapflow-leads', []) || []).map(lead => [lead.id, leadFingerprint(lead)]));

  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage) return;
    if (key === 'zapflow-leads') {
      clearTimeout(leadTimer);
      leadTimer = setTimeout(() => {
        try {
          const nextLeads = JSON.parse(value);
          if (!Array.isArray(nextLeads)) return;
          const nextSnapshot = new Map(nextLeads.map(lead => [lead.id, leadFingerprint(lead)]));
          const changed = nextLeads.filter(lead => lastSnapshot.get(lead.id) !== nextSnapshot.get(lead.id));
          lastSnapshot = nextSnapshot;
          if (changed.length) syncLeads(changed, userId).catch(console.error);
        } catch {}
      }, 180);
    }
  };

  resolveActiveWorkspaceId(userId)
    .then(workspaceId => {
      if (!workspaceId) return;
      const refreshWorkspace = payload => {
        const actorId = payload?.new?.last_modified_by || null;
        if (payload?.eventType !== 'DELETE' && actorId && actorId === userId) return;
        window.clearTimeout(window.__zapflowRemoteRefreshTimer);
        window.__zapflowRemoteRefreshTimer = window.setTimeout(async () => {
          try {
            const freshLeads = await loadLeads(userId);
            lastSnapshot = new Map(freshLeads.map(lead => [lead.id, leadFingerprint(lead)]));
            originalSetItem.call(localStorage, 'zapflow-leads', JSON.stringify(freshLeads));
            window.dispatchEvent(new CustomEvent('zapflow:remote-leads', { detail: { leads: freshLeads } }));
          } catch (error) {
            console.error('Workspace realtime refresh failed:', error);
          }
        }, 120);
      };

      const workspaceFilter = `workspace_id=eq.${workspaceId}`;
      const channel = supabase
        .channel(`workspace-leads-${workspaceId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: workspaceFilter }, refreshWorkspace)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: workspaceFilter }, refreshWorkspace)
        // Supabase Postgres Changes does not support filters on DELETE events.
        // Treat any delete as an invalidation signal, then re-fetch the current RLS-scoped workspace.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, refreshWorkspace)
        .subscribe();
      window.__zapflowRealtimeChannel = channel;
    })
    .catch(error => console.error('Workspace realtime setup failed:', error));

  window.__zapflowSupabaseSignOut = () => supabase.auth.signOut({ scope: 'local' });
}