begin;

grant insert on table public.workspace_invites to authenticated;

create policy workspace_invites_insert_admin
on public.workspace_invites for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_workspace_admin(workspace_id, (select auth.uid()))
);

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

create or replace function public.set_active_workspace(_workspace_id uuid)
returns void
language plpgsql
security invoker
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
revoke execute on function public.set_active_workspace(uuid) from public, anon;
grant execute on function public.create_workspace_invite(uuid) to authenticated;
grant execute on function public.set_active_workspace(uuid) to authenticated;

commit;
