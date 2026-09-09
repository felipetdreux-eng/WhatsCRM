-- ZapFlow initial Supabase backend schema
create extension if not exists pgcrypto;
grant usage on schema public to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  selling_type text check (selling_type in ('services','products','both')),
  goal text check (goal in ('organize','followups','sales')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  company text not null default '',
  phone text not null,
  value numeric(12,2) not null default 0 check (value >= 0),
  sale_value numeric(12,2) check (sale_value is null or sale_value > 0),
  sale_value_source text check (sale_value_source in ('confirmed','legacy-potential','missing')),
  status text not null default 'Novo lead' check (status in ('Novo lead','Contatado','Interessado','Proposta enviada','Vendido','Perdido')),
  origin text not null default 'Outro' check (origin in ('Google Maps','Instagram','Indicação','Site','WhatsApp','Outro')),
  notes text not null default '',
  next_contact date,
  next_contact_time time,
  next_action text not null default '',
  last_followup_at timestamptz,
  sold_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_user_phone_unique unique (user_id, phone),
  constraint sold_value_consistency check ((status='Vendido' and sale_value is not null) or (status<>'Vendido' and sale_value is null))
);
create index if not exists leads_user_status_idx on public.leads(user_id,status);
create index if not exists leads_user_next_contact_idx on public.leads(user_id,next_contact);
create index if not exists leads_user_created_at_idx on public.leads(user_id,created_at desc);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text,
  title text not null check (char_length(trim(title)) > 0),
  category text not null default '',
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_user_key_unique unique (user_id, template_key)
);
create index if not exists message_templates_user_idx on public.message_templates(user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name','')) on conflict(id) do nothing; return new; end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
drop trigger if exists message_templates_set_updated_at on public.message_templates;
create trigger message_templates_set_updated_at before update on public.message_templates for each row execute function public.set_updated_at();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.message_templates enable row level security;
revoke all on table public.profiles, public.leads, public.message_templates from anon, authenticated;
grant select,insert,update,delete on table public.profiles, public.leads, public.message_templates to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid())=id);
create policy leads_select_own on public.leads for select to authenticated using ((select auth.uid())=user_id);
create policy leads_insert_own on public.leads for insert to authenticated with check ((select auth.uid())=user_id);
create policy leads_update_own on public.leads for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy leads_delete_own on public.leads for delete to authenticated using ((select auth.uid())=user_id);
create policy message_templates_select_own on public.message_templates for select to authenticated using ((select auth.uid())=user_id);
create policy message_templates_insert_own on public.message_templates for insert to authenticated with check ((select auth.uid())=user_id);
create policy message_templates_update_own on public.message_templates for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy message_templates_delete_own on public.message_templates for delete to authenticated using ((select auth.uid())=user_id);
