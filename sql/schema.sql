-- Familienplaner: Datenbank-Schema für Supabase
-- Im Supabase-Dashboard unter "SQL Editor" komplett einfügen und "Run" drücken.

create extension if not exists "pgcrypto";

-- Familien (jede Familie hat einen Einladungscode)
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

-- Profile (ein Login-Konto = ein Profil in einer Familie)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references families(id) on delete cascade,
  name text not null,
  color text not null default '#4f8cff',
  avatar text default '🙂',
  is_admin boolean default false,
  ical_url text,
  created_at timestamptz default now()
);

-- Aufgaben mit Punkten
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  points int not null default 5,
  assigned_to uuid references profiles(id) on delete set null,
  done boolean default false,
  done_by uuid references profiles(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz default now()
);

-- Einkaufsliste
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  amount text,
  checked boolean default false,
  meal_id uuid,
  created_at timestamptz default now()
);

-- Nachrichten (Familien-Chat / Pinnwand)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  author uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

-- Essensplan, Wünsche und Rezepte
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  plan_date date,                 -- leer = nur Wunsch, noch nicht eingeplant
  wished_by uuid references profiles(id) on delete set null,
  image_url text,
  recipe text,
  ingredients text,               -- eine Zutat pro Zeile
  created_at timestamptz default now()
);

-- Eigene Kalendereinträge der Familie
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  owner uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Hilfsfunktion: zu welcher Familie gehört der angemeldete Nutzer?
create or replace function my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = auth.uid()
$$;

-- Familie neu anlegen (Ersteller wird Admin)
create or replace function create_family(fam_name text, my_name text, my_color text, my_avatar text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  insert into families(name) values (fam_name) returning id into fid;
  insert into profiles(id, family_id, name, color, avatar, is_admin)
    values (auth.uid(), fid, my_name, my_color, my_avatar, true);
  return fid;
end $$;

-- Einer Familie per Code beitreten
create or replace function join_family(code text, my_name text, my_color text, my_avatar text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  select id into fid from families where invite_code = lower(code);
  if fid is null then raise exception 'Code unbekannt'; end if;
  insert into profiles(id, family_id, name, color, avatar)
    values (auth.uid(), fid, my_name, my_color, my_avatar);
  return fid;
end $$;

-- Sicherheit: jeder sieht und ändert nur Daten der eigenen Familie
alter table families        enable row level security;
alter table profiles        enable row level security;
alter table tasks           enable row level security;
alter table shopping_items  enable row level security;
alter table messages        enable row level security;
alter table meals           enable row level security;
alter table events          enable row level security;

create policy fam_read on families for select using (id = my_family());
create policy fam_update_admin on families for update using (id = my_family() and exists (select 1 from profiles where id = auth.uid() and is_admin)) with check (id = my_family());
create policy prof_read on profiles for select using (family_id = my_family());
create policy prof_update_self on profiles for update using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['tasks','shopping_items','messages','meals','events'] loop
    execute format('create policy %I_all on %I for all using (family_id = my_family()) with check (family_id = my_family())', t, t);
  end loop;
end $$;

-- Live-Aktualisierung für Tablet-Display
alter publication supabase_realtime add table tasks, shopping_items, messages, meals, events, profiles;

-- Speicher für Essensbilder
insert into storage.buckets (id, name, public) values ('meal-images', 'meal-images', true)
  on conflict do nothing;
create policy meal_img_read on storage.objects for select using (bucket_id = 'meal-images');
create policy meal_img_write on storage.objects for insert to authenticated with check (bucket_id = 'meal-images');
