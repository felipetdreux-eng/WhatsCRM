-- Repair migration for projects created from the pre-workspace schema.
-- It is intentionally idempotent so it can also repair an already deployed database.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Minha equipe',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null default 10 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists start_mode text not null default 'demo';
alter table public.profiles add column if not exists active_workspace_id uuid;
alter table public.leads add column if not exists workspace_id uuid;
alter table public.leads add column if not exists assigned_to uuid;
alter table public.leads add column if not exists last_modified_by uuid;
alter table public.leads add column if not exists last_response_at timestamptz;
alter table public.workspace_invites add column if not exists id uuid default gen_random_uuid();
alter table public.workspace_invites add column if not exists max_uses integer not null default 10;
alter table public.workspace_invites add column if not exists uses integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_active_workspace_id_fkey') then
    alter table public.profiles add constraint profiles_active_workspace_id_fkey
      foreign key (active_workspace_id) references public.workspaces(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_workspace_id_fkey') then
    alter table public.leads add constraint leads_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_assigned_to_fkey') then
    alter table public.leads add constraint leads_assigned_to_fkey
      foreign key (assigned_to) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_last_modified_by_fkey') then
    alter table public.leads add constraint leads_last_modified_by_fkey
      foreign key (last_modified_by) references auth.users(id) on delete set null;
  end if;
end;
$$;

insert into public.profiles(id, name)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Usuário')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.workspaces(name, owner_id)
select coalesce(nullif(p.name, ''), 'Minha equipe'), p.id
from public.profiles p
where not exists (
  select 1 from public.workspace_members wm where wm.user_id = p.id
);

insert into public.workspace_members(workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = w.id and wm.user_id = w.owner_id
);

update public.profiles p
set active_workspace_id = (
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = p.id
  order by wm.joined_at asc
  limit 1
)
where p.active_workspace_id is null
   or not exists (
     select 1 from public.workspace_members current_members
     where current_members.workspace_id = p.active_workspace_id
       and current_members.user_id = p.id
   );

update public.leads l
set workspace_id = p.active_workspace_id
from public.profiles p
where l.workspace_id is null and p.id = l.user_id;

update public.leads l
set assigned_to = coalesce(l.assigned_to, l.user_id),
    last_modified_by = coalesce(l.last_modified_by, l.user_id)
where l.assigned_to is null or l.last_modified_by is null;

do $$
begin
  if exists (select 1 from public.leads where workspace_id is null) then
    raise exception 'workspace_backfill_incomplete';
  end if;
  alter table public.leads alter column workspace_id set not null;
end;
$$;

alter table public.leads drop constraint if exists leads_user_phone_unique;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_workspace_phone_unique') then
    alter table public.leads add constraint leads_workspace_phone_unique unique (workspace_id, phone);
  end if;
end;
$$;

create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);
create index if not exists workspace_invites_created_by_idx on public.workspace_invites(created_by);
create index if not exists profiles_active_workspace_id_idx on public.profiles(active_workspace_id);
create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_last_modified_by_idx on public.leads(last_modified_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select wm.workspace_id from public.workspace_members wm where wm.user_id = (select auth.uid());
$$;

create or replace function private.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = _workspace_id and wm.user_id = _user_id
  );
$$;

create or replace function private.is_workspace_admin(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = _workspace_id
      and wm.user_id = _user_id
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function private.can_access_lead(_lead_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leads l
    join public.workspace_members wm on wm.workspace_id = l.workspace_id
    where l.id = _lead_id and wm.user_id = _user_id
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text := trim(coalesce(new.raw_user_meta_data->>'name', ''));
  workspace_name text;
begin
  workspace_name := case
    when char_length(raw_name) between 2 and 72 then raw_name || ' · Equipe'
    else 'Minha equipe'
  end;

  insert into public.profiles(id, name)
  values(new.id, raw_name)
  on conflict(id) do nothing;

  insert into public.workspaces(id, name, owner_id)
  values(new.id, workspace_name, new.id)
  on conflict (id) do nothing;

  insert into public.workspace_members(workspace_id, user_id, role)
  values(new.id, new.id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  update public.profiles set active_workspace_id = new.id where id = new.id;
  return new;
end;
$$;

create or replace function public.create_workspace_invite(_workspace_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  invite_code text;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if not private.is_workspace_admin(_workspace_id, caller) then raise exception 'workspace_invite_forbidden'; end if;

  loop
    invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.workspace_invites(code, workspace_id, created_by, expires_at)
      values(invite_code, _workspace_id, caller, now() + interval '7 days');
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  return invite_code;
end;
$$;

create or replace function public.join_workspace_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_workspace uuid;
  inserted_count integer := 0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select wi.workspace_id into target_workspace from public.workspace_invites wi
  where upper(wi.code) = upper(trim(coalesce(_code, '')))
    and wi.expires_at > now()
    and wi.uses < wi.max_uses
  order by wi.created_at desc
  limit 1;
  if target_workspace is null then raise exception 'invalid_workspace_invite'; end if;
  insert into public.workspace_members(workspace_id, user_id, role)
  values(target_workspace, caller, 'member') on conflict (workspace_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then
    update public.workspace_invites
    set uses = uses + 1
    where workspace_id = target_workspace
      and upper(code) = upper(trim(coalesce(_code, '')));
  end if;
  update public.profiles set active_workspace_id = target_workspace where id = caller;
  return target_workspace;
end;
$$;

create or replace function public.set_active_workspace(_workspace_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null or not private.is_workspace_member(_workspace_id, caller) then raise exception 'workspace_access_denied'; end if;
  update public.profiles set active_workspace_id = _workspace_id where id = caller;
end;
$$;

revoke all on function private.user_workspace_ids() from public, anon;
grant execute on function private.user_workspace_ids() to authenticated;
revoke all on function private.is_workspace_member(uuid, uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid, uuid) to authenticated;
revoke all on function private.is_workspace_admin(uuid, uuid) from public, anon;
grant execute on function private.is_workspace_admin(uuid, uuid) to authenticated;
revoke all on function private.can_access_lead(uuid, uuid) from public, anon;
grant execute on function private.can_access_lead(uuid, uuid) to authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_workspace_invite(uuid) from public, anon;
grant execute on function public.create_workspace_invite(uuid) to authenticated;
revoke all on function public.join_workspace_by_code(text) from public, anon;
grant execute on function public.join_workspace_by_code(text) to authenticated;
revoke all on function public.set_active_workspace(uuid) from public, anon;
grant execute on function public.set_active_workspace(uuid) to authenticated;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
drop trigger if exists message_templates_set_updated_at on public.message_templates;
create trigger message_templates_set_updated_at before update on public.message_templates for each row execute function public.set_updated_at();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
drop function if exists public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.leads enable row level security;
revoke all on table public.workspaces, public.workspace_members, public.workspace_invites from anon, authenticated;
grant select, update on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;
grant insert on table public.workspace_invites to authenticated;
grant select, insert, update, delete on table public.leads to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_workspace on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_own_workspace on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_select_workspace on public.profiles for select to authenticated using (
  (select auth.uid()) = id
  or id in (select wm.user_id from public.workspace_members wm where wm.workspace_id in (select private.user_workspace_ids()))
);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy profiles_update_own_workspace on public.profiles for update to authenticated using ((select auth.uid())=id) with check (
  (select auth.uid())=id
  and (active_workspace_id is null or active_workspace_id in (select private.user_workspace_ids()))
);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid())=id);

drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_update_owner on public.workspaces;
drop policy if exists workspace_members_select_member on public.workspace_members;
drop policy if exists workspace_members_select_team on public.workspace_members;
create policy workspaces_select_member on public.workspaces for select to authenticated using (id in (select private.user_workspace_ids()));
create policy workspaces_update_owner on public.workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy workspace_members_select_team on public.workspace_members for select to authenticated using (workspace_id in (select private.user_workspace_ids()));
drop policy if exists workspace_invites_insert_admin on public.workspace_invites;
create policy workspace_invites_insert_admin on public.workspace_invites for insert to authenticated with check (
  created_by = (select auth.uid())
  and private.is_workspace_admin(workspace_id, (select auth.uid()))
);

drop policy if exists leads_select_own on public.leads;
drop policy if exists leads_insert_own on public.leads;
drop policy if exists leads_update_own on public.leads;
drop policy if exists leads_delete_own on public.leads;
drop policy if exists leads_select_workspace on public.leads;
drop policy if exists leads_insert_workspace on public.leads;
drop policy if exists leads_update_workspace on public.leads;
drop policy if exists leads_delete_workspace on public.leads;
create policy leads_select_workspace on public.leads for select to authenticated using (workspace_id in (select private.user_workspace_ids()));
create policy leads_insert_workspace on public.leads for insert to authenticated with check (
  workspace_id in (select private.user_workspace_ids())
  and user_id = (select auth.uid())
  and (assigned_to is null or private.is_workspace_member(workspace_id, assigned_to))
);
create policy leads_update_workspace on public.leads for update to authenticated using (workspace_id in (select private.user_workspace_ids())) with check (
  workspace_id in (select private.user_workspace_ids())
  and (assigned_to is null or private.is_workspace_member(workspace_id, assigned_to))
);
create policy leads_delete_workspace on public.leads for delete to authenticated using (workspace_id in (select private.user_workspace_ids()));

do $$
begin
  if to_regclass('public.lead_activities') is not null then
    execute 'drop policy if exists "lead_activities_select_own" on public.lead_activities';
    execute 'drop policy if exists "lead_activities_insert_own" on public.lead_activities';
    execute 'drop policy if exists "lead_activities_select_workspace" on public.lead_activities';
    execute 'drop policy if exists "lead_activities_insert_workspace" on public.lead_activities';
    execute 'create policy "lead_activities_select_workspace" on public.lead_activities for select to authenticated using (private.can_access_lead(lead_id, (select auth.uid())))';
    execute 'create policy "lead_activities_insert_workspace" on public.lead_activities for insert to authenticated with check ((select auth.uid()) = user_id and private.can_access_lead(lead_id, (select auth.uid())))';
    execute 'grant select, insert on table public.lead_activities to authenticated';
  end if;
end;
$$;

