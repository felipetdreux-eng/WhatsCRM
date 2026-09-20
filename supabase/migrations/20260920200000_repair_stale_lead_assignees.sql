-- Keep lead ownership consistent with the workspace membership model.
--
-- Older records could retain an assignee from before shared workspaces were
-- introduced. Reassign those records to the workspace owner, then reject any
-- future assignment to a user who is not a member of that workspace.

update public.leads as lead
set
  assigned_to = workspace.owner_id,
  updated_at = now()
from public.workspaces as workspace
where workspace.id = lead.workspace_id
  and exists (
    select 1
    from public.workspace_members as owner_membership
    where owner_membership.workspace_id = workspace.id
      and owner_membership.user_id = workspace.owner_id
  )
  and not exists (
    select 1
    from public.workspace_members as assignee_membership
    where assignee_membership.workspace_id = lead.workspace_id
      and assignee_membership.user_id = lead.assigned_to
  );

create or replace function private.enforce_lead_assignee_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.assigned_to is not null
    and not exists (
      select 1
      from public.workspace_members as membership
      where membership.workspace_id = new.workspace_id
        and membership.user_id = new.assigned_to
    )
  then
    raise exception 'Lead assignee must belong to the lead workspace'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_lead_assignee_membership() from public;

drop trigger if exists leads_enforce_assignee_membership on public.leads;
create trigger leads_enforce_assignee_membership
before insert or update of workspace_id, assigned_to on public.leads
for each row
execute function private.enforce_lead_assignee_membership();
