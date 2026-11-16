-- Version 21.5: Spielhalle zeigt "ist online / spielt gerade" und "zuletzt gespielt von".
-- Tabelle arcade_presence: pro Person eine Zeile, die die offene Spielhalle alle 20 Sek. aktualisiert (arcade_ping).
-- "Online" = letzter Ping vor weniger als 60 Sekunden. Zugriff nur ueber die Funktionen (keine direkten Tabellenrechte).
-- arcade_online(): wer ist gerade in der Spielhalle (eigene + verbundene Familien), mit Spiel falls gerade eines laeuft.
-- arcade_last(): pro Spiel das letzte Ergebnis (wer, wann) in eigener + verbundener Familie.

create table if not exists arcade_presence (
  profile_id uuid primary key references profiles(id) on delete cascade,
  family_id uuid not null,
  game text,
  updated_at timestamptz not null default now()
);
alter table arcade_presence enable row level security;

create or replace function arcade_ping(p_game text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); fam uuid := my_family();
begin
  if me is null or fam is null then return; end if;
  insert into arcade_presence(profile_id, family_id, game, updated_at) values (me, fam, p_game, now())
  on conflict (profile_id) do update set family_id = excluded.family_id, game = excluded.game, updated_at = now();
end $$;

create or replace function arcade_leave() returns void
language sql security definer set search_path to 'public' as $$
  delete from arcade_presence where profile_id = auth.uid() $$;

create or replace function arcade_online()
returns table(profile_id uuid, name text, family_name text, game text)
language sql stable security definer set search_path to 'public' as $$
  select a.profile_id, p.name, f.name, a.game
  from arcade_presence a join profiles p on p.id = a.profile_id join families f on f.id = a.family_id
  where a.updated_at > now() - interval '60 seconds'
    and (a.family_id = my_family() or a.family_id in (select linked_families()))
  order by (a.game is null), p.name $$;

create or replace function arcade_last()
returns table(game text, profile_id uuid, name text, family_name text, score integer, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select distinct on (s.game) s.game, s.profile_id, p.name, f.name, s.score, s.created_at
  from arcade_scores s join profiles p on p.id = s.profile_id join families f on f.id = s.family_id
  where s.family_id = my_family() or s.family_id in (select linked_families())
  order by s.game, s.created_at desc $$;

revoke all on function arcade_ping(text), arcade_leave(), arcade_online(), arcade_last() from public, anon;
grant execute on function arcade_ping(text), arcade_leave(), arcade_online(), arcade_last() to authenticated;
