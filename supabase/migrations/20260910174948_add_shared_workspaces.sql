begin;

create schema if not exists private;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
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
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 10 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists active_workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.leads
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists last_modified_by uuid references auth.users(id) on delete set null;

insert into public.workspaces (id, name, owner_id)
select p.id,
       case when char_length(trim(coalesce(p.name, ''))) >= 2 then trim(p.name) || ' · Equipe' else 'Minha equipe' end,
       p.id
from public.profiles p
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select p.id, p.id, 'owner'
from public.profiles p
on conflict (workspace_id, user_id) do update set role = 'owner';

update public.profiles
set active_workspace_id = id
where active_workspace_id is null;

update public.leads
set workspace_id = coalesce(workspace_id, user_id),
    assigned_to = coalesce(assigned_to, user_id),
    last_modified_by = coalesce(last_modified_by, user_id)
where workspace_id is null or assigned_to is null or last_modified_by is null;

alter table public.leads alter column workspace_id set not null;

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists workspace_invites_workspace_id_idx on public.workspace_invites(workspace_id);
create index if not exists workspace_invites_code_idx on public.workspace_invites(code);
create index if not exists leads_workspace_id_idx on public.leads(workspace_id);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists profiles_active_workspace_id_idx on public.profiles(active_workspace_id);

create or replace function private.user_workspace_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = (select auth.uid())
$$;

create or replace function private.workspace_user_ids(_workspace_id uuid)
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = _workspace_id
$$;

create or replace function private.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = _workspace_id and wm.user_id = _user_id
  )
$$;

create or replace function private.is_workspace_admin(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = _workspace_id
      and wm.user_id = _user_id
      and wm.role in ('owner','admin')
  )
$$;

create or replace function private.can_access_lead(_lead_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.leads l
    join public.workspace_members wm on wm.workspace_id = l.workspace_id
    where l.id = _lead_id and wm.user_id = _user_id
  )
$$;

revoke all on function private.user_workspace_ids() from public;
revoke all on function private.workspace_user_ids(uuid) from public;
revoke all on function private.is_workspace_member(uuid, uuid) from public;
revoke all on function private.is_workspace_admin(uuid, uuid) from public;
revoke all on function private.can_access_lead(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.user_workspace_ids() to authenticated;
grant execute on function private.workspace_user_ids(uuid) to authenticated;
grant execute on function private.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function private.is_workspace_admin(uuid, uuid) to authenticated;
grant execute on function private.can_access_lead(uuid, uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
revoke all on table public.workspace_invites from anon, authenticated;
grant select, update on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;

create policy workspaces_select_member
on public.workspaces for select
to authenticated
using (id in (select private.user_workspace_ids()));

create policy workspaces_update_owner
on public.workspaces for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy workspace_members_select_team
on public.workspace_members for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

-- Leads now belong to a workspace. user_id is retained as the original creator/legacy actor.
drop policy if exists leads_select_own on public.leads;
drop policy if exists leads_insert_own on public.leads;
drop policy if exists leads_update_own on public.leads;
drop policy if exists leads_delete_own on public.leads;

create policy leads_select_workspace
on public.leads for select
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create policy leads_insert_workspace
on public.leads for insert
to authenticated
with check (
  workspace_id in (select private.user_workspace_ids())
  and user_id = (select auth.uid())
  and (assigned_to is null or private.is_workspace_member(workspace_id, assigned_to))
);

create policy leads_update_workspace
on public.leads for update
to authenticated
using (workspace_id in (select private.user_workspace_ids()))
with check (
  workspace_id in (select private.user_workspace_ids())
  and (assigned_to is null or private.is_workspace_member(workspace_id, assigned_to))
);

create policy leads_delete_workspace
on public.leads for delete
to authenticated
using (workspace_id in (select private.user_workspace_ids()));

create or replace function private.protect_lead_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.workspace_id := old.workspace_id;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists leads_protect_scope on public.leads;
create trigger leads_protect_scope
before update on public.leads
for each row execute function private.protect_lead_scope();

-- Team members can see each other's profiles so assignee names can be rendered.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_workspace
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or id in (
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id in (select private.user_workspace_ids())
  )
);

create policy profiles_update_own_workspace
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and (active_workspace_id is null or active_workspace_id in (select private.user_workspace_ids()))
);

-- Activity history is shared with everyone who can access the lead; user_id remains the actor.
drop policy if exists lead_activities_select_own on public.lead_activities;
drop policy if exists lead_activities_insert_own on public.lead_activities;

create policy lead_activities_select_workspace
on public.lead_activities for select
to authenticated
using (private.can_access_lead(lead_id, (select auth.uid())));

create policy lead_activities_insert_workspace
on public.lead_activities for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_access_lead(lead_id, (select auth.uid()))
);

create or replace function public.create_workspace_invite(_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  invite_code text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not private.is_workspace_admin(_workspace_id, caller) then raise exception 'Only workspace admins can invite members'; end if;

  loop
    invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.workspace_invites(workspace_id, code, created_by)
      values (_workspace_id, invite_code, caller);
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
  if caller is null then raise exception 'Authentication required'; end if;

  select wi.workspace_id into target_workspace
  from public.workspace_invites wi
  where upper(wi.code) = upper(trim(_code))
    and wi.expires_at > now()
    and wi.uses < wi.max_uses
  order by wi.created_at desc
  limit 1
  for update;

  if target_workspace is null then raise exception 'Invalid or expired invite code'; end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (target_workspace, caller, 'member')
  on conflict (workspace_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.workspace_invites
    set uses = uses + 1
    where workspace_id = target_workspace and upper(code) = upper(trim(_code));
  end if;

  update public.profiles set active_workspace_id = target_workspace where id = caller;
  return target_workspace;
end;
$$;

create or replace function public.set_active_workspace(_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not private.is_workspace_member(_workspace_id, caller) then raise exception 'Not a workspace member'; end if;
  update public.profiles set active_workspace_id = _workspace_id where id = caller;
end;
$$;

revoke execute on function public.create_workspace_invite(uuid) from public, anon;
revoke execute on function public.join_workspace_by_code(text) from public, anon;
revoke execute on function public.set_active_workspace(uuid) from public, anon;
grant execute on function public.create_workspace_invite(uuid) to authenticated;
grant execute on function public.join_workspace_by_code(text) to authenticated;
grant execute on function public.set_active_workspace(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_name text;
begin
  insert into public.profiles(id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;

  workspace_name := case
    when char_length(trim(coalesce(new.raw_user_meta_data ->> 'name', ''))) >= 2
      then trim(new.raw_user_meta_data ->> 'name') || ' · Equipe'
    else 'Minha equipe'
  end;

  insert into public.workspaces(id, name, owner_id)
  values (new.id, workspace_name, new.id)
  on conflict (id) do nothing;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  update public.profiles set active_workspace_id = new.id where id = new.id;
  return new;
end;
$$;

-- Keep workspace timestamps consistent with the rest of the app.
drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

-- Realtime enables teammates to receive lead changes later without changing the data model again.
do $$
begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then
  null;
end $$;

commit;
