-- Small hardening pass for the workspace/site backend.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "site_integrations_manage_owner" on public.site_integrations;
drop policy if exists "site_integrations_insert_owner" on public.site_integrations;
drop policy if exists "site_integrations_update_owner" on public.site_integrations;
drop policy if exists "site_integrations_delete_owner" on public.site_integrations;

create policy "site_integrations_insert_owner"
on public.site_integrations
for insert
to authenticated
with check (owner_id = (select auth.uid()) and workspace_id in (select private.user_workspace_ids()));

create policy "site_integrations_update_owner"
on public.site_integrations
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()) and workspace_id in (select private.user_workspace_ids()));

create policy "site_integrations_delete_owner"
on public.site_integrations
for delete
to authenticated
using (owner_id = (select auth.uid()));

create index if not exists site_integrations_workspace_id_idx on public.site_integrations(workspace_id);
create index if not exists site_integrations_owner_id_idx on public.site_integrations(owner_id);

