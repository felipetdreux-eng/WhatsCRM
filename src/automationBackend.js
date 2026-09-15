import { supabase } from './supabaseClient';

export const DEFAULT_AUTOMATION_SETTINGS = Object.freeze({
  enabled: true,
  first_contact_enabled: true,
  first_contact_delay_minutes: 5,
  followup_enabled: true,
  followup_delay_hours: 24,
  max_followup_attempts: 3,
  pause_on_response: true,
  pause_on_stage_change: true,
});

const DEMO_SETTINGS_KEY = 'fuply-automation-settings-demo';

function readDemoSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_SETTINGS_KEY) || '{}');
    return { ...DEFAULT_AUTOMATION_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_AUTOMATION_SETTINGS };
  }
}

function cleanSettings(row) {
  return {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...(row || {}),
    first_contact_delay_minutes: Number(row?.first_contact_delay_minutes ?? DEFAULT_AUTOMATION_SETTINGS.first_contact_delay_minutes),
    followup_delay_hours: Number(row?.followup_delay_hours ?? DEFAULT_AUTOMATION_SETTINGS.followup_delay_hours),
    max_followup_attempts: Number(row?.max_followup_attempts ?? DEFAULT_AUTOMATION_SETTINGS.max_followup_attempts),
  };
}

async function resolveContext() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return null;

  const user = userData.user;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_workspace_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.active_workspace_id) return null;

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id,name,owner_id')
    .eq('id', profile.active_workspace_id)
    .single();
  if (workspaceError || !workspace) return null;

  return {
    user,
    workspace,
    workspaceId: workspace.id,
    canConfigure: workspace.owner_id === user.id,
  };
}

export async function loadAutomationDashboard() {
  const context = await resolveContext();
  if (!context) {
    return {
      demo: true,
      workspaceName: 'Demonstração',
      canConfigure: true,
      settings: readDemoSettings(),
      outbox: [],
    };
  }

  const [{ data: settingsRow, error: settingsError }, { data: outbox, error: outboxError }] = await Promise.all([
    supabase
      .from('workspace_automation_settings')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .maybeSingle(),
    supabase
      .from('automation_outbox')
      .select('id,lead_id,kind,status,scheduled_at,attempt_no,message,reason,cancel_reason,sent_at,created_at,updated_at')
      .eq('workspace_id', context.workspaceId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (settingsError) throw settingsError;
  if (outboxError) throw outboxError;

  return {
    demo: false,
    workspaceName: context.workspace.name,
    canConfigure: context.canConfigure,
    settings: cleanSettings(settingsRow),
    outbox: outbox || [],
  };
}

export async function saveAutomationSettings(nextSettings) {
  const clean = cleanSettings(nextSettings);
  const context = await resolveContext();

  if (!context) {
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(clean));
    return clean;
  }

  if (!context.canConfigure) {
    throw new Error('Somente o dono da equipe pode alterar as automações.');
  }

  const payload = {
    workspace_id: context.workspaceId,
    enabled: Boolean(clean.enabled),
    first_contact_enabled: Boolean(clean.first_contact_enabled),
    first_contact_delay_minutes: Math.min(1440, Math.max(0, Number(clean.first_contact_delay_minutes) || 0)),
    followup_enabled: Boolean(clean.followup_enabled),
    followup_delay_hours: Math.min(720, Math.max(1, Number(clean.followup_delay_hours) || 24)),
    max_followup_attempts: Math.min(10, Math.max(1, Number(clean.max_followup_attempts) || 3)),
    pause_on_response: Boolean(clean.pause_on_response),
    pause_on_stage_change: Boolean(clean.pause_on_stage_change),
  };

  const { data, error } = await supabase
    .from('workspace_automation_settings')
    .upsert(payload, { onConflict: 'workspace_id' })
    .select('*')
    .single();
  if (error) throw error;
  return cleanSettings(data);
}

export async function runAutomationsNow() {
  const context = await resolveContext();
  if (!context) return 0;
  const { data, error } = await supabase.rpc('run_automations_now', { _workspace_id: context.workspaceId });
  if (error) throw error;
  return Number(data || 0);
}

export async function cancelAutomationItem(itemId) {
  if (!itemId) return;
  const { error } = await supabase
    .from('automation_outbox')
    .update({ status: 'cancelled', cancel_reason: 'manual_cancel' })
    .eq('id', itemId)
    .in('status', ['pending', 'ready']);
  if (error) throw error;
}

export async function recordLeadResponseForAutomation(leadId) {
  if (!leadId) return false;
  const { data, error } = await supabase.rpc('record_lead_response', { _lead_id: leadId });
  if (error) throw error;
  return Boolean(data);
}

export function automationStatusLabel(status) {
  if (status === 'ready') return 'Pronta';
  if (status === 'pending') return 'Agendada';
  if (status === 'sent') return 'Enviada';
  if (status === 'failed') return 'Falhou';
  return 'Cancelada';
}

export function automationKindLabel(kind) {
  return kind === 'first_contact' ? 'Primeiro contato' : 'Follow-up';
}
