create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('lead_created','whatsapp_opened','status_changed','followup_scheduled','followup_completed','sale_closed','lead_updated')),
  title text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_user_lead_created_idx
  on public.lead_activities(user_id, lead_id, created_at desc);

alter table public.lead_activities enable row level security;

create policy "lead_activities_select_own"
  on public.lead_activities for select
  to authenticated
  using (auth.uid() = user_id);

create policy "lead_activities_insert_own"
  on public.lead_activities for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id
        and leads.user_id = auth.uid()
    )
  );

revoke all on table public.lead_activities from anon;
grant select, insert on table public.lead_activities to authenticated;
