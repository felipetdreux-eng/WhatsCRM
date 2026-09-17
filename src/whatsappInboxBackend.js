import { supabase } from './supabaseClient';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function mapWhatsAppMessage(row) {
  return {
    id: row.id,
    side: row.direction === 'outbound' ? 'outbound' : 'inbound',
    time: formatTime(row.occurred_at),
    text: row.body || (row.has_media ? '[Arquivo]' : ''),
    meta: row.has_media && row.media_filename ? row.media_filename : '',
    occurredAt: row.occurred_at,
  };
}

export async function loadWhatsAppConnectionStatus() {
  const { data, error } = await supabase
    .from('whatsapp_integrations')
    .select('workspace_id,provider,session_name,enabled,last_event_at,last_event_id,updated_at')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function loadLeadWhatsAppMessages(leadId, limit = 120) {
  if (!leadId) return [];
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id,lead_id,direction,body,has_media,media_mimetype,media_filename,occurred_at,created_at')
    .eq('lead_id', leadId)
    .order('occurred_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapWhatsAppMessage);
}

export function subscribeToLeadWhatsAppMessages(leadId, onMessage) {
  if (!leadId || typeof onMessage !== 'function') return () => {};

  const channel = supabase
    .channel(`whatsapp-inbox-${leadId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `lead_id=eq.${leadId}`,
      },
      payload => onMessage(mapWhatsAppMessage(payload.new)),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
