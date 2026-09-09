alter table public.profiles
add column if not exists tutorial_completed boolean not null default false;

comment on column public.profiles.tutorial_completed is 'Whether the user has completed or skipped the in-app guided tutorial.';
