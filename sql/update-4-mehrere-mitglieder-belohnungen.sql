-- Version 11: Aufgaben für mehrere Mitglieder und Belohnungen bei Punktezahl.
-- (Schon in Supabase eingespielt als Migration "tasks_assignees_rewards".)
alter table public.tasks add column if not exists assignees uuid[] not null default '{}';
update public.tasks set assignees = array[assigned_to] where assigned_to is not null and assignees = '{}';

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  points int not null check (points >= 0 and points <= 100000),
  title text not null check (char_length(title) between 1 and 120),
  claimed boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.rewards enable row level security;
create or replace function public.i_am_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;
create policy rewards_read on public.rewards for select using (family_id = my_family());
create policy rewards_ins on public.rewards for insert with check (family_id = my_family() and i_am_admin());
create policy rewards_upd on public.rewards for update using (family_id = my_family() and i_am_admin()) with check (family_id = my_family() and i_am_admin());
create policy rewards_del on public.rewards for delete using (family_id = my_family() and i_am_admin());
alter publication supabase_realtime add table public.rewards;
