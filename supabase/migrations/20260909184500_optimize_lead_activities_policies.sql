create index if not exists lead_activities_lead_id_created_idx
  on public.lead_activities(lead_id, created_at desc);

drop policy if exists "lead_activities_select_own" on public.lead_activities;
drop policy if exists "lead_activities_insert_own" on public.lead_activities;

create policy "lead_activities_select_own"
  on public.lead_activities for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "lead_activities_insert_own"
  on public.lead_activities for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id
        and leads.user_id = (select auth.uid())
    )
  );
