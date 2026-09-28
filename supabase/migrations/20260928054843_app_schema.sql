-- CalSnap schema: one row set per signed-in user, mirroring src/lib/types.ts.
-- Every table has RLS on, and each policy limits a user to rows where user_id = auth.uid().

-- Onboarding answers + daily goals (Profile + Goals). One row per user.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goal text not null check (goal in ('lose', 'maintain', 'gain', 'muscle')),
  sex text not null check (sex in ('male', 'female')),
  age smallint not null check (age between 10 and 120),
  height_cm numeric(5, 1) not null check (height_cm between 50 and 300),
  weight_kg numeric(5, 1) not null check (weight_kg between 20 and 500),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  pace_kg_per_week numeric(3, 2) not null default 0 check (pace_kg_per_week between 0 and 2),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 20 and 500),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  goal_calories integer not null default 2200 check (goal_calories between 0 and 20000),
  goal_protein integer not null default 150 check (goal_protein between 0 and 2000),
  goal_carbs integer not null default 220 check (goal_carbs between 0 and 2000),
  goal_fat integer not null default 75 check (goal_fat between 0 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) <= 200),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  photo_uri text check (char_length(photo_uri) <= 2048), -- local device path; photos aren't uploaded
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 32768),
  servings numeric(5, 2) not null default 1 check (servings > 0 and servings <= 100),
  calories numeric(7, 1) not null check (calories >= 0),
  protein numeric(6, 1) not null check (protein >= 0),
  carbs numeric(6, 1) not null check (carbs >= 0),
  fat numeric(6, 1) not null check (fat >= 0),
  day date not null,
  eaten_at timestamptz not null, -- Meal.createdAt
  logged_at timestamptz,
  primary key (user_id, id)
);
create index meals_user_day_idx on public.meals (user_id, day);

-- At most one weigh-in per day.
create table public.weight_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  kg numeric(5, 1) not null check (kg between 20 and 500),
  logged_at timestamptz,
  primary key (user_id, day)
);

create table public.reminders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  label text not null check (char_length(label) <= 100),
  kind text not null check (kind in ('breakfast', 'lunch', 'dinner', 'streak', 'custom')),
  enabled boolean not null default true,
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null check (minute between 0 and 59),
  primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.weight_entries enable row level security;
alter table public.reminders enable row level security;

-- Owner-only policies. `(select auth.uid())` is evaluated once per query instead of per row.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'meals', 'weight_entries', 'reminders'] loop
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Signed-out (anon) callers get nothing, even if a policy is later loosened by mistake.
revoke all on public.profiles, public.meals, public.weight_entries, public.reminders from anon;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
