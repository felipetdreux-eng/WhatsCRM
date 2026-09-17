create or replace function public.remove_workspace_member(
  _workspace_id uuid,
  _user_id uuid
)
returns boolean
language plpgsql
security definer
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

  update public.profiles p
  set active_workspace_id = (
    select fallback.workspace_id
    from public.workspace_members fallback
    where fallback.user_id = _user_id
    order by fallback.joined_at asc
    limit 1
  )
  where p.id = _user_id
    and p.active_workspace_id = _workspace_id;

  return true;
end;
$$;

revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
