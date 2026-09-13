alter table public.leads drop constraint if exists leads_user_phone_unique;
alter table public.leads add constraint leads_workspace_phone_unique unique (workspace_id, phone);
