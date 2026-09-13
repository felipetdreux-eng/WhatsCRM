drop index if exists public.leads_user_created_at_idx;
drop index if exists public.leads_user_status_idx;
drop index if exists public.leads_user_next_contact_idx;
create index if not exists leads_workspace_created_at_idx on public.leads (workspace_id, created_at desc);
create index if not exists leads_workspace_status_idx on public.leads (workspace_id, status);
create index if not exists leads_workspace_next_contact_idx on public.leads (workspace_id, next_contact);
