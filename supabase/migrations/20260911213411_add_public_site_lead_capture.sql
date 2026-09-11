create table if not exists public.site_integrations (
  id uuid primary key default gen_random_uuid(),
  public_key uuid not null unique default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_name text not null,
  origin_label text not null default 'Site' check (origin_label in ('Google Maps','Instagram','Indicação','Site','WhatsApp','Outro')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_integrations enable row level security;

create policy "site_integrations_select_workspace"
on public.site_integrations
for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create policy "site_integrations_manage_owner"
on public.site_integrations
for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()) and workspace_id in (select private.user_workspace_ids()));

create or replace function public.submit_site_lead(
  _site_key uuid,
  _name text,
  _phone text,
  _service text default null,
  _budget text default null,
  _message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg public.site_integrations%rowtype;
  lead_id uuid;
  clean_name text;
  clean_phone text;
  clean_service text;
  clean_budget text;
  clean_message text;
  note_text text;
begin
  select * into cfg
  from public.site_integrations
  where public_key = _site_key and enabled = true
  limit 1;

  if not found then
    raise exception 'Integração de site inválida ou desativada.';
  end if;

  clean_name := left(trim(coalesce(_name, '')), 120);
  clean_phone := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  clean_service := left(trim(coalesce(_service, '')), 160);
  clean_budget := left(trim(coalesce(_budget, '')), 120);
  clean_message := left(trim(coalesce(_message, '')), 1500);

  if char_length(clean_name) < 2 then
    raise exception 'Nome inválido.';
  end if;

  if char_length(clean_phone) < 8 or char_length(clean_phone) > 15 then
    raise exception 'WhatsApp inválido.';
  end if;

  note_text := concat_ws(E'\n',
    case when clean_service <> '' then 'Interesse: ' || clean_service end,
    case when clean_budget <> '' then 'Faixa de investimento: ' || clean_budget end,
    case when clean_message <> '' then 'Mensagem do site: ' || clean_message end,
    'Captado automaticamente pelo site ' || cfg.site_name
  );

  insert into public.leads (
    user_id, workspace_id, assigned_to, last_modified_by, name, company, phone, value,
    status, origin, notes, next_action, created_at, updated_at
  ) values (
    cfg.owner_id, cfg.workspace_id, cfg.owner_id, cfg.owner_id, clean_name, '', clean_phone, 0,
    'Novo lead', cfg.origin_label, note_text, 'Responder lead do site', now(), now()
  )
  on conflict (user_id, phone) do update
  set
    notes = concat_ws(E'\n\n', nullif(public.leads.notes, ''), excluded.notes),
    next_action = 'Responder novo pedido do site',
    updated_at = now(),
    last_modified_by = cfg.owner_id
  returning id into lead_id;

  return lead_id;
end;
$$;

revoke all on function public.submit_site_lead(uuid,text,text,text,text,text) from public;
grant execute on function public.submit_site_lead(uuid,text,text,text,text,text) to anon, authenticated;
