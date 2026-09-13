alter table public.lead_activities drop constraint if exists lead_activities_kind_check;
alter table public.lead_activities add constraint lead_activities_kind_check check (
  kind in (
    'lead_created',
    'whatsapp_opened',
    'status_changed',
    'followup_scheduled',
    'followup_completed',
    'sale_closed',
    'lead_updated',
    'lead_lost',
    'lead_reassigned',
    'autopilot_outcome'
  )
);
