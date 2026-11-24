-- Phase 2 — Task 4: Daily Biometrics Table for Apple HealthKit & Google Health Connect
-- Stores objective recovery metrics (sleep duration, daily steps, resting heart rate)
-- for the deterministic Double Progression and volume readiness engine.

create table if not exists public.daily_biometrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_key text not null,
  provider text not null check (provider in ('apple_healthkit', 'google_health_connect', 'manual_override')),
  recorded_date date not null,
  sleep_hours numeric(4, 2) not null check (sleep_hours >= 0 and sleep_hours <= 24),
  daily_steps integer not null check (daily_steps >= 0 and daily_steps <= 200000),
  resting_heart_rate integer check (resting_heart_rate is null or (resting_heart_rate >= 25 and resting_heart_rate <= 220)),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (account_key, recorded_date)
);

create index if not exists idx_daily_biometrics_user_date
  on public.daily_biometrics (user_id, recorded_date desc);

create index if not exists idx_daily_biometrics_account_date
  on public.daily_biometrics (account_key, recorded_date desc);

alter table public.daily_biometrics enable row level security;

drop policy if exists "Users can read own daily biometrics" on public.daily_biometrics;
create policy "Users can read own daily biometrics"
  on public.daily_biometrics
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily biometrics" on public.daily_biometrics;
create policy "Users can insert own daily biometrics"
  on public.daily_biometrics
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily biometrics" on public.daily_biometrics;
create policy "Users can update own daily biometrics"
  on public.daily_biometrics
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
