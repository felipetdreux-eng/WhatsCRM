create table if not exists public.whatsapp_integrations (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  provider text not null default 'waha' check (provider = 'waha'),
  session_name text not null default 'default',
  webhook_token_hash text not null,
  enabled boolean not null default true,
  last_event_at timestamptz,
  last_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  external_message_id text not null,
  event_type text not null default 'message.any',
  session_name text not null default 'default',
  chat_id text not null,
  contact_id text not null,
  contact_phone text,
  direction text not null check (direction in ('inbound','outbound')),
  sender_name text,
  body text not null default '',
  has_media boolean not null default false,
  media_mimetype text,
  media_filename text,
  occurred_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, external_message_id)
);

create index if not exists whatsapp_messages_workspace_time_idx
  on public.whatsapp_messages(workspace_id, occurred_at desc);
create index if not exists whatsapp_messages_lead_time_idx
  on public.whatsapp_messages(lead_id, occurred_at asc)
  where lead_id is not null;
create index if not exists whatsapp_messages_phone_time_idx
  on public.whatsapp_messages(workspace_id, contact_phone, occurred_at desc)
  where contact_phone is not null;

alter table public.whatsapp_integrations enable row level security;
alter table public.whatsapp_messages enable row level security;

grant select on public.whatsapp_integrations to authenticated;
grant select on public.whatsapp_messages to authenticated;

create policy "whatsapp_integrations_select_workspace"
on public.whatsapp_integrations for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create policy "whatsapp_messages_select_workspace"
on public.whatsapp_messages for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create or replace function private.touch_whatsapp_integration_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists whatsapp_integrations_touch on public.whatsapp_integrations;
create trigger whatsapp_integrations_touch
before update on public.whatsapp_integrations
for each row execute function private.touch_whatsapp_integration_updated_at();

create or replace function public.ingest_waha_event(
  _webhook_token text,
  _event text,
  _session text,
  _payload jsonb,
  _request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  integration public.whatsapp_integrations%rowtype;
  external_id text;
  contact_id text;
  digits text;
  local_digits text;
  matched_lead uuid;
  from_me boolean := coalesce((_payload->>'fromMe')::boolean, false);
  occurred timestamptz := now();
  ts numeric;
  message_body text;
  media_type text;
  media_name text;
  inserted_id uuid;
begin
  if coalesce(_webhook_token, '') = '' then
    raise exception 'invalid_webhook_token';
  end if;

  select * into integration
  from public.whatsapp_integrations wi
  where wi.enabled
    and wi.webhook_token_hash = encode(extensions.digest(_webhook_token, 'sha256'), 'hex')
  limit 1;

  if not found then
    raise exception 'invalid_webhook_token';
  end if;

  update public.whatsapp_integrations
  set last_event_at = now(), last_event_id = _request_id
  where workspace_id = integration.workspace_id;

  if _event not in ('message', 'message.any') then
    return jsonb_build_object('accepted', true, 'stored', false, 'reason', 'event_ignored');
  end if;

  if _payload is null then
    return jsonb_build_object('accepted', true, 'stored', false, 'reason', 'empty_payload');
  end if;

  contact_id := case when from_me then coalesce(_payload->>'to', '') else coalesce(_payload->>'from', '') end;

  if contact_id = ''
     or contact_id like '%@g.us'
     or contact_id like '%@newsletter'
     or contact_id = 'status@broadcast' then
    return jsonb_build_object('accepted', true, 'stored', false, 'reason', 'non_direct_chat');
  end if;

  digits := regexp_replace(contact_id, '\D', '', 'g');
  if contact_id like '%@lid' then
    digits := null;
  end if;

  if digits is not null and digits like '55%' and length(digits) in (12, 13) then
    local_digits := substring(digits from 3);
  else
    local_digits := digits;
  end if;

  if digits is not null then
    select l.id into matched_lead
    from public.leads l
    where l.workspace_id = integration.workspace_id
      and regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') in (digits, local_digits)
    order by l.updated_at desc nulls last, l.created_at desc nulls last
    limit 1;
  end if;

  begin
    ts := nullif(_payload->>'timestamp', '')::numeric;
    if ts is not null then
      occurred := case when ts > 100000000000 then to_timestamp(ts / 1000.0) else to_timestamp(ts) end;
    end if;
  exception when others then
    occurred := now();
  end;

  external_id := coalesce(nullif(_payload->>'id', ''), nullif(_request_id, ''), gen_random_uuid()::text);
  media_type := nullif(_payload#>>'{media,mimetype}', '');
  media_name := nullif(_payload#>>'{media,filename}', '');
  message_body := coalesce(_payload->>'body', '');

  if message_body = '' and coalesce((_payload->>'hasMedia')::boolean, false) then
    message_body := case
      when media_type like 'audio/%' then '[Áudio]'
      when media_type like 'image/%' then '[Imagem]'
      when media_type like 'video/%' then '[Vídeo]'
      else '[Arquivo]'
    end;
  end if;

  insert into public.whatsapp_messages(
    workspace_id, lead_id, external_message_id, event_type, session_name,
    chat_id, contact_id, contact_phone, direction, sender_name, body,
    has_media, media_mimetype, media_filename, occurred_at, raw_payload
  ) values (
    integration.workspace_id,
    matched_lead,
    external_id,
    coalesce(_event, 'message.any'),
    coalesce(nullif(_session, ''), integration.session_name),
    contact_id,
    contact_id,
    local_digits,
    case when from_me then 'outbound' else 'inbound' end,
    coalesce(nullif(_payload->>'notifyName', ''), nullif(_payload#>>'{_data,notifyName}', '')),
    message_body,
    coalesce((_payload->>'hasMedia')::boolean, false),
    media_type,
    media_name,
    occurred,
    _payload
  )
  on conflict (workspace_id, external_message_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null and matched_lead is not null and not from_me then
    update public.leads
    set last_response_at = greatest(coalesce(last_response_at, '-infinity'::timestamptz), occurred),
        updated_at = greatest(coalesce(updated_at, '-infinity'::timestamptz), occurred)
    where id = matched_lead;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'stored', inserted_id is not null,
    'leadMatched', matched_lead is not null,
    'leadId', matched_lead,
    'direction', case when from_me then 'outbound' else 'inbound' end
  );
end;
$$;

revoke all on function public.ingest_waha_event(text,text,text,jsonb,text) from public;
grant execute on function public.ingest_waha_event(text,text,text,jsonb,text) to anon;

alter table public.whatsapp_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;
end;
$$;
