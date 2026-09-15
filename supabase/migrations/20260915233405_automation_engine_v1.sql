create extension if not exists pg_cron;

alter table public.leads
  add column if not exists last_response_at timestamptz;

create table if not exists public.workspace_automation_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  first_contact_enabled boolean not null default true,
  first_contact_delay_minutes integer not null default 5 check (first_contact_delay_minutes between 0 and 1440),
  followup_enabled boolean not null default true,
  followup_delay_hours integer not null default 24 check (followup_delay_hours between 1 and 720),
  max_followup_attempts integer not null default 3 check (max_followup_attempts between 1 and 10),
  pause_on_response boolean not null default true,
  pause_on_stage_change boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('first_contact', 'followup')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'sent', 'cancelled', 'failed')),
  scheduled_at timestamptz not null,
  attempt_no integer not null default 1 check (attempt_no > 0),
  message text not null,
  reason text not null default '',
  cancel_reason text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_outbox_workspace_status_idx
  on public.automation_outbox(workspace_id, status, scheduled_at);
create index if not exists automation_outbox_lead_idx
  on public.automation_outbox(lead_id, created_at desc);
create unique index if not exists automation_outbox_one_active_per_kind_idx
  on public.automation_outbox(lead_id, kind)
  where status in ('pending', 'ready');
create unique index if not exists automation_outbox_first_contact_once_idx
  on public.automation_outbox(lead_id)
  where kind = 'first_contact';

alter table public.workspace_automation_settings enable row level security;
alter table public.automation_outbox enable row level security;

grant select, insert, update on public.workspace_automation_settings to authenticated;
grant select, insert, update on public.automation_outbox to authenticated;

create policy "automation_settings_select_workspace"
on public.workspace_automation_settings for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create policy "automation_settings_insert_owner"
on public.workspace_automation_settings for insert
to authenticated
with check (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_id = (select auth.uid())
  )
);

create policy "automation_settings_update_owner"
on public.workspace_automation_settings for update
to authenticated
using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_id = (select auth.uid())
  )
);

create policy "automation_outbox_select_workspace"
on public.automation_outbox for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create policy "automation_outbox_insert_workspace"
on public.automation_outbox for insert
to authenticated
with check (workspace_id in (select private.user_workspace_ids()));

create policy "automation_outbox_update_workspace"
on public.automation_outbox for update
to authenticated
using (workspace_id in (select private.user_workspace_ids()))
with check (workspace_id in (select private.user_workspace_ids()));

create or replace function private.touch_automation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workspace_automation_settings_touch on public.workspace_automation_settings;
create trigger workspace_automation_settings_touch
before update on public.workspace_automation_settings
for each row execute function private.touch_automation_updated_at();

drop trigger if exists automation_outbox_touch on public.automation_outbox;
create trigger automation_outbox_touch
before update on public.automation_outbox
for each row execute function private.touch_automation_updated_at();

insert into public.workspace_automation_settings(workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

create or replace function private.seed_workspace_automation_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.workspace_automation_settings(workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_seed_automation_settings on public.workspaces;
create trigger workspaces_seed_automation_settings
after insert on public.workspaces
for each row execute function private.seed_workspace_automation_settings();

create or replace function private.automation_message(
  _name text,
  _status text,
  _kind text,
  _attempt integer
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  first_name text := coalesce(nullif(split_part(trim(coalesce(_name, '')), ' ', 1), ''), 'tudo bem');
begin
  if _kind = 'first_contact' then
    return format('Oi, %s! Tudo bem? Vi seu contato por aqui e queria entender melhor o que você precisa. Posso te fazer uma pergunta rápida?', first_name);
  end if;

  if _attempt >= 3 then
    return format('Oi, %s! Passando uma última vez para saber se ainda faz sentido continuarmos essa conversa. Se não for prioridade agora, sem problema, só me avisa para eu organizar por aqui.', first_name);
  end if;

  if _status = 'Proposta enviada' then
    return format('Oi, %s! Conseguiu analisar a proposta? Se tiver algum ponto travando a decisão, me fala que eu tento resolver por aqui.', first_name);
  elsif _status = 'Negociação' then
    return format('Oi, %s! Queria retomar nossa negociação e fechar os próximos passos. O que falta definirmos para conseguir avançar?', first_name);
  elsif _status = 'Interessado' then
    return format('Oi, %s! Queria retomar o que conversamos. Qual é o principal ponto que falta resolver para conseguirmos avançar?', first_name);
  else
    return format('Oi, %s! Tudo bem? Passando para retomar nossa conversa. Ainda faz sentido falarmos sobre isso?', first_name);
  end if;
end;
$$;

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

create or replace function private.process_automations()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  row_settings record;
  total integer := 0;
begin
  for row_settings in
    select workspace_id from public.workspace_automation_settings where enabled
  loop
    total := total + private.process_workspace_automations(row_settings.workspace_id);
  end loop;
  return total;
end;
$$;

create or replace function private.cancel_automation_on_lead_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cfg public.workspace_automation_settings%rowtype;
begin
  select * into cfg
  from public.workspace_automation_settings
  where workspace_id = new.workspace_id;

  if new.status in ('Fechado', 'Perdido') then
    update public.automation_outbox
    set status = 'cancelled', cancel_reason = 'lead_closed'
    where lead_id = new.id and status in ('pending', 'ready');
    return new;
  end if;

  if found and cfg.pause_on_stage_change and new.status is distinct from old.status then
    update public.automation_outbox
    set status = 'cancelled', cancel_reason = 'stage_changed'
    where lead_id = new.id and status in ('pending', 'ready');
  end if;

  if found and cfg.pause_on_response and new.last_response_at is distinct from old.last_response_at and new.last_response_at is not null then
    update public.automation_outbox
    set status = 'cancelled', cancel_reason = 'lead_replied'
    where lead_id = new.id and status in ('pending', 'ready');
  end if;

  return new;
end;
$$;

drop trigger if exists leads_cancel_automation_on_change on public.leads;
create trigger leads_cancel_automation_on_change
after update of status, last_response_at on public.leads
for each row execute function private.cancel_automation_on_lead_change();

create or replace function public.run_automations_now(_workspace_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_workspace_member(_workspace_id, (select auth.uid())) then
    raise exception 'workspace_not_allowed';
  end if;
  return private.process_workspace_automations(_workspace_id);
end;
$$;

create or replace function public.record_lead_response(_lead_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  touched integer;
begin
  update public.leads
  set last_response_at = now(),
      updated_at = now(),
      last_modified_by = (select auth.uid())
  where id = _lead_id
    and workspace_id in (select private.user_workspace_ids());
  get diagnostics touched = row_count;
  return touched = 1;
end;
$$;

revoke all on function public.run_automations_now(uuid) from public, anon;
revoke all on function public.record_lead_response(uuid) from public, anon;
grant execute on function public.run_automations_now(uuid) to authenticated;
grant execute on function public.record_lead_response(uuid) to authenticated;

select cron.schedule(
  'fuply-automation-engine',
  '*/5 * * * *',
  $$select private.process_automations();$$
);
