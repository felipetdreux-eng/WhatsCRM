grant delete on table public.workspace_members to authenticated;

drop policy if exists workspace_members_delete_owner on public.workspace_members;
create policy workspace_members_delete_owner
on public.workspace_members
for delete
to authenticated
using (
  user_id <> (select auth.uid())
  and role <> 'owner'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create or replace function private.sync_removed_member_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set active_workspace_id = (
    select fallback.workspace_id
    from public.workspace_members fallback
    where fallback.user_id = old.user_id
    order by fallback.joined_at asc
    limit 1
  )
  where p.id = old.user_id
    and p.active_workspace_id = old.workspace_id;

  return old;
end;
$$;

revoke all on function private.sync_removed_member_workspace() from public, anon, authenticated;

drop trigger if exists workspace_members_sync_removed_profile on public.workspace_members;
create trigger workspace_members_sync_removed_profile
after delete on public.workspace_members
for each row execute function private.sync_removed_member_workspace();

create or replace function public.remove_workspace_member(
  _workspace_id uuid,
  _user_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_role text;
  deleted_count integer := 0;
begin
  if caller is null then
    raise exception 'authentication_required';
  end if;

  if caller = _user_id then
    raise exception 'cannot_remove_self';
  end if;

  if not exists (
    select 1
    from public.workspaces w
    where w.id = _workspace_id
      and w.owner_id = caller
  ) then
    raise exception 'workspace_owner_required';
  end if;

  select wm.role
  into target_role
  from public.workspace_members wm
  where wm.workspace_id = _workspace_id
    and wm.user_id = _user_id;

  if target_role is null then
    raise exception 'workspace_member_not_found';
  end if;

  if target_role = 'owner' then
    raise exception 'cannot_remove_workspace_owner';
  end if;

  delete from public.workspace_members wm
  where wm.workspace_id = _workspace_id
    and wm.user_id = _user_id
    and wm.role <> 'owner';

  get diagnostics deleted_count = row_count;

  if deleted_count <> 1 then
    raise exception 'workspace_member_not_removed';
  end if;

  return true;
end;
$$;

revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
