-- Driveway Daily database setup. Supabase → SQL Editor (source set to your database, not "Logs") → Run.
-- One row per user holds the whole app. Only the signed-in owner can read or write it.
-- Safe to run more than once.

create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "owner only" on public.app_state;

create policy "owner only" on public.app_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Signed-in users may use the table (the policy above still limits them to their own row).
grant select, insert, update on public.app_state to authenticated;
