delete from public.automation_outbox o
using public.leads l, public.workspace_automation_settings s
where o.lead_id = l.id
  and o.workspace_id = s.workspace_id
  and o.kind = 'first_contact'
  and o.status in ('pending', 'ready')
  and l.created_at < s.created_at;

create or replace function private.process_workspace_automations(_workspace_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  cfg public.workspace_automation_settings%rowtype;
  affected integer := 0;
  changed integer := 0;
begin
  select * into cfg
  from public.workspace_automation_settings
  where workspace_id = _workspace_id;

  if not found or not cfg.enabled then
    return 0;
  end if;

  update public.automation_outbox o
  set status = 'cancelled', cancel_reason = 'lead_closed'
  from public.leads l
  where o.lead_id = l.id
    and o.workspace_id = _workspace_id
    and o.status in ('pending', 'ready')
    and l.status in ('Fechado', 'Perdido');
  get diagnostics changed = row_count;
  affected := affected + changed;

  if cfg.first_contact_enabled then
    insert into public.automation_outbox(
      workspace_id, lead_id, kind, status, scheduled_at, attempt_no, message, reason
    )
    select
      l.workspace_id,
      l.id,
      'first_contact',
      'pending',
      l.created_at + make_interval(mins => cfg.first_contact_delay_minutes),
      1,
      private.automation_message(l.name, l.status, 'first_contact', 1),
      'Novo lead entrou no Fuply e ainda precisa de primeiro contato.'
    from public.leads l
    where l.workspace_id = _workspace_id
      and l.created_at >= cfg.created_at
      and l.status = 'Novo lead'
      and l.last_response_at is null
      and l.last_followup_at is null
      and not exists (
        select 1 from public.automation_outbox existing
        where existing.lead_id = l.id and existing.kind = 'first_contact'
      )
    on conflict do nothing;
    get diagnostics changed = row_count;
    affected := affected + changed;
  end if;

  if cfg.followup_enabled then
    insert into public.automation_outbox(
      workspace_id, lead_id, kind, status, scheduled_at, attempt_no, message, reason, metadata
    )
    select
      l.workspace_id,
      l.id,
      'followup',
      'pending',
      now(),
      coalesce(sent.sent_count, 0) + 1,
      private.automation_message(l.name, l.status, 'followup', coalesce(sent.sent_count, 0) + 1),
      format('%s horas sem nova interação nesta negociação.', cfg.followup_delay_hours),
      jsonb_build_object('idle_hours', floor(extract(epoch from (now() - activity.last_activity_at)) / 3600))
    from public.leads l
    cross join lateral (
      select greatest(
        l.created_at,
        l.updated_at,
        coalesce(l.last_followup_at, '-infinity'::timestamptz),
        coalesce(l.last_response_at, '-infinity'::timestamptz)
      ) as last_activity_at
    ) activity
    left join lateral (
      select count(*)::integer as sent_count
      from public.automation_outbox history
      where history.lead_id = l.id
        and history.kind = 'followup'
        and history.status = 'sent'
    ) sent on true
    where l.workspace_id = _workspace_id
      and l.status not in ('Fechado', 'Perdido', 'Novo lead')
      and activity.last_activity_at <= now() - make_interval(hours => cfg.followup_delay_hours)
      and coalesce(sent.sent_count, 0) < cfg.max_followup_attempts
      and not exists (
        select 1 from public.automation_outbox active
        where active.lead_id = l.id
          and active.status in ('pending', 'ready')
      )
    on conflict do nothing;
    get diagnostics changed = row_count;
    affected := affected + changed;
  end if;

  update public.automation_outbox
  set status = 'ready'
  where workspace_id = _workspace_id
    and status = 'pending'
    and scheduled_at <= now();
  get diagnostics changed = row_count;
  affected := affected + changed;

  return affected;
end;
$$;
