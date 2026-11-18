-- Version 22: Flammen, Weitergeben-Karte, Duell "Code knacken", Admin-Schalter
-- Wird per Supabase-Migration eingespielt (diese Datei dient zum Nachschlagen).

/* ---------- Admin-Einstellungen pro Familie ---------- */
alter table families
  add column if not exists flame_on boolean not null default true,
  add column if not exists flame_symbol text not null default 'flame' check (flame_symbol in ('flame', 'heart', 'poop')),
  add column if not exists flame1_days int not null default 3 check (flame1_days between 1 and 30),
  add column if not exists flame2_days int not null default 3 check (flame2_days between 1 and 30),
  add column if not exists flame3_tasks int not null default 3 check (flame3_tasks between 1 and 50),
  add column if not exists red_tabs_on boolean not null default true,
  add column if not exists push_blink_on boolean not null default true,
  add column if not exists pass_on boolean not null default true,
  add column if not exists pass_price int not null default 10 check (pass_price between 0 and 1000);

/* ---------- Flammen ---------- */
create table if not exists flame_state (
  profile_id uuid primary key references profiles(id) on delete cascade,
  family_id uuid not null,
  open_streak int not null default 0, open_at timestamptz,
  act_streak int not null default 0, act_at timestamptz
);
alter table flame_state enable row level security;
drop policy if exists flame_read on flame_state;
create policy flame_read on flame_state for select using (family_id = my_family());

-- Zaehlt einen Tag dazu: gleitende 24 Stunden. Unter 24 Std. nach dem letzten gezaehlten Tag = noch nichts neues,
-- 24 bis 48 Std. = naechster Tag der Serie, ueber 48 Std. = Serie faengt bei 1 neu an.
create or replace function flame_bump(p_profile uuid, p_act boolean) returns void
language plpgsql security definer set search_path = public as $$
declare fam uuid; st flame_state%rowtype;
begin
  select family_id into fam from profiles where id = p_profile;
  if fam is null then return; end if;
  insert into flame_state(profile_id, family_id) values (p_profile, fam) on conflict (profile_id) do nothing;
  select * into st from flame_state where profile_id = p_profile for update;
  if not p_act then
    if st.open_at is null or now() - st.open_at >= interval '48 hours' then st.open_streak := 1; st.open_at := now();
    elsif now() - st.open_at >= interval '24 hours' then st.open_streak := st.open_streak + 1; st.open_at := now(); end if;
  else
    if st.act_at is null or now() - st.act_at >= interval '48 hours' then st.act_streak := 1; st.act_at := now();
    elsif now() - st.act_at >= interval '24 hours' then st.act_streak := st.act_streak + 1; st.act_at := now(); end if;
  end if;
  update flame_state set family_id = fam, open_streak = st.open_streak, open_at = st.open_at,
    act_streak = st.act_streak, act_at = st.act_at where profile_id = p_profile;
end $$;
revoke all on function flame_bump(uuid, boolean) from public, anon, authenticated;

create or replace function flame_open() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then perform flame_bump(auth.uid(), false); end if;
end $$;

-- Erledigte Aufgaben der letzten 7 Tage pro Person (freigegebene aus dem Punktekonto + noch wartende)
create or replace function flame_week() returns table(profile_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select x.pid, count(*)::int from (
    select l.profile_id as pid from point_log l where l.family_id = my_family() and l.kind = 'task' and l.created_at > now() - interval '7 days'
    union all
    select t.done_by from tasks t where t.family_id = my_family() and t.done and not t.approved and t.done_by is not null and t.done_at > now() - interval '7 days'
  ) x group by x.pid $$;

-- Interaktion = Stimmung, Aufgabe erledigt, Chat geschrieben, Spiel gespielt
create or replace function flame_act_msg() returns trigger language plpgsql security definer set search_path = public as $$
begin begin perform flame_bump(new.author, true); exception when others then null; end; return new; end $$;
drop trigger if exists flame_act_msg on messages;
create trigger flame_act_msg after insert on messages for each row execute function flame_act_msg();

create or replace function flame_act_task() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.done and not old.done and new.done_by is not null then
    begin perform flame_bump(new.done_by, true); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists flame_act_task on tasks;
create trigger flame_act_task after update on tasks for each row execute function flame_act_task();

create or replace function flame_act_score() returns trigger language plpgsql security definer set search_path = public as $$
begin begin perform flame_bump(new.profile_id, true); exception when others then null; end; return new; end $$;
drop trigger if exists flame_act_score on arcade_scores;
create trigger flame_act_score after insert on arcade_scores for each row execute function flame_act_score();

create or replace function flame_act_mood() returns trigger language plpgsql security definer set search_path = public as $$
begin begin perform flame_bump(new.id, true); exception when others then null; end; return new; end $$;
drop trigger if exists flame_act_mood on profiles;
create trigger flame_act_mood after update of mood_at on profiles for each row
  when (new.mood_at is distinct from old.mood_at and new.mood is not null) execute function flame_act_mood();

/* ---------- Weitergeben-Karte ---------- */
alter table tasks
  add column if not exists passed_by uuid,
  add column if not exists passed_at timestamptz,
  add column if not exists pass_open boolean not null default false;

alter table point_log drop constraint if exists point_log_kind_check;
alter table point_log add constraint point_log_kind_check check (kind in ('task', 'reward', 'manual', 'mood', 'pass'));

create or replace function pass_task(p_task uuid, p_to uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); fam uuid := my_family(); t tasks%rowtype; f families%rowtype;
        bal int; ids uuid[]; secret text; nm text;
begin
  if me is null or fam is null then raise exception 'Nicht angemeldet'; end if;
  select * into f from families where id = fam;
  if not f.pass_on then raise exception 'Die Weitergeben-Karte ist ausgeschaltet'; end if;
  select * into t from tasks where id = p_task and family_id = fam for update;
  if not found then raise exception 'Aufgabe nicht gefunden'; end if;
  if t.done then raise exception 'Die Aufgabe ist schon erledigt'; end if;
  ids := case when coalesce(array_length(t.assignees, 1), 0) > 0 then t.assignees
              when t.assigned_to is not null then array[t.assigned_to] else '{}'::uuid[] end;
  if not (me = any(ids)) then raise exception 'Du kannst nur Aufgaben weitergeben, die dir zugeteilt sind'; end if;
  select coalesce(sum(points), 0) into bal from point_log where profile_id = me;
  if bal < f.pass_price then raise exception 'Zu wenig Punkte: Die Karte kostet % Punkte', f.pass_price; end if;
  if p_to is not null then
    if p_to = me then raise exception 'Du kannst die Karte nicht an dich selbst weitergeben'; end if;
    if not exists (select 1 from profiles where id = p_to and family_id = fam) then raise exception 'Person nicht gefunden'; end if;
    update tasks set assignees = array[p_to], assigned_to = null, passed_by = me, passed_at = now(), pass_open = false where id = p_task;
  else
    select array_agg(id) into ids from profiles where family_id = fam and id <> me;
    if ids is null then raise exception 'Es gibt niemanden, an den du weitergeben kannst'; end if;
    update tasks set assignees = ids, assigned_to = null, passed_by = me, passed_at = now(), pass_open = true where id = p_task;
  end if;
  if f.pass_price > 0 then
    insert into point_log(family_id, profile_id, points, kind, reason, created_by)
    values (fam, me, -f.pass_price, 'pass', 'Weitergeben-Karte: ' || t.title, me);
  end if;
  begin
    select value into secret from push_config where key = 'hook_secret';
    select name into nm from profiles where id = me;
    perform net.http_post(
      url := 'https://wpiqwoprnoasuckrdwlr.supabase.co/functions/v1/push-send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret),
      body := jsonb_build_object('kind', 'task', 'family_id', fam, 'actor', me, 'title', '🃏 Aufgabe weitergegeben',
        'body', nm || ' gibt weiter: ' || t.title, 'user_ids', case when p_to is not null then to_jsonb(array[p_to]) else null end,
        'tab', 'todo', 'item', p_task));
  exception when others then null; end;
end $$;

/* ---------- Duell "Code knacken" ---------- */
alter table arcade_scores drop constraint if exists arcade_scores_game_check;
alter table arcade_scores add constraint arcade_scores_game_check
  check (game in ('snake', 'memory', 'reaktion', 'flappy', 'frogger', 'pong', 'farben', 'bonbon', 'code'));

create table if not exists duels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  a_profile uuid not null references profiles(id) on delete cascade, a_family uuid not null,
  b_profile uuid not null references profiles(id) on delete cascade, b_family uuid not null,
  status text not null default 'invite' check (status in ('invite', 'playing', 'done', 'declined', 'cancelled')),
  winner uuid, started_at timestamptz, ended_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists duel_secrets (
  duel_id uuid not null references duels(id) on delete cascade,
  profile_id uuid not null, code text not null,
  primary key (duel_id, profile_id)
);
create table if not exists duel_guesses (
  id bigserial primary key,
  duel_id uuid not null references duels(id) on delete cascade,
  profile_id uuid not null, n int not null, guess text not null, black int not null, white int not null,
  created_at timestamptz not null default now()
);
alter table duels enable row level security;
alter table duel_secrets enable row level security;   -- keine Richtlinie = niemand kann die Codes direkt lesen
alter table duel_guesses enable row level security;
drop policy if exists duels_read on duels;
create policy duels_read on duels for select using (auth.uid() in (a_profile, b_profile));
drop policy if exists duel_guesses_read on duel_guesses;
create policy duel_guesses_read on duel_guesses for select
  using (exists (select 1 from duels d where d.id = duel_id and auth.uid() in (d.a_profile, d.b_profile)));

create or replace function gen_code() returns text language sql volatile as $$
  select string_agg((floor(random() * 6))::int::text, '') from generate_series(1, 4) $$;
revoke all on function gen_code() from public, anon, authenticated;

create or replace function duel_cleanup() returns void language sql security definer set search_path = public as $$
  update duels set status = 'cancelled', updated_at = now() where status = 'invite' and created_at < now() - interval '3 minutes';
  update duels set status = 'cancelled', updated_at = now() where status = 'playing' and updated_at < now() - interval '30 minutes';
$$;

create or replace function duel_invite(p_to uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); fam uuid := my_family(); tf uuid; id uuid;
begin
  if me is null or fam is null then raise exception 'Nicht angemeldet'; end if;
  if p_to = me then raise exception 'Du kannst dich nicht selbst herausfordern'; end if;
  perform duel_cleanup();
  select family_id into tf from profiles where id = p_to;
  if tf is null or not (tf = fam or tf in (select linked_families())) then raise exception 'Diese Person ist nicht verbunden'; end if;
  if not exists (select 1 from arcade_presence where profile_id = p_to and updated_at > now() - interval '60 seconds') then
    raise exception 'Die Person ist gerade nicht in der Spielhalle'; end if;
  if exists (select 1 from duels where status in ('invite', 'playing') and (me in (a_profile, b_profile) or p_to in (a_profile, b_profile))) then
    raise exception 'Du oder die andere Person habt schon ein laufendes Duell'; end if;
  insert into duels(a_profile, a_family, b_profile, b_family) values (me, fam, p_to, tf) returning duels.id into id;
  return id;
end $$;

create or replace function duel_answer(p_duel uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duels%rowtype;
begin
  select * into d from duels where id = p_duel for update;
  if not found or d.b_profile <> me or d.status <> 'invite' then raise exception 'Die Einladung gibt es nicht mehr'; end if;
  if d.created_at < now() - interval '3 minutes' then
    update duels set status = 'cancelled', updated_at = now() where id = p_duel;
    raise exception 'Die Einladung ist abgelaufen';
  end if;
  if not p_accept then update duels set status = 'declined', updated_at = now() where id = p_duel; return; end if;
  insert into duel_secrets(duel_id, profile_id, code) values (p_duel, d.a_profile, gen_code()), (p_duel, d.b_profile, gen_code());
  update duels set status = 'playing', started_at = now(), updated_at = now() where id = p_duel;
end $$;

-- Rate: 4 Stellen aus den Zeichen 0-5. Rueckmeldung: black = richtig und am richtigen Platz, white = richtig, falscher Platz.
create or replace function duel_guess(p_duel uuid, p_guess text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duels%rowtype; s text; n int; b int := 0; w int := 0; i int;
        cs int[] := array_fill(0, array[6]); cg int[] := array_fill(0, array[6]); opp uuid; oppn int; ofam uuid; mfam uuid;
begin
  select * into d from duels where id = p_duel for update;
  if not found or me not in (d.a_profile, d.b_profile) then raise exception 'Duell nicht gefunden'; end if;
  if d.status <> 'playing' then raise exception 'Das Duell ist schon vorbei'; end if;
  if p_guess !~ '^[0-5]{4}$' then raise exception 'Bitte 4 Felder fuellen'; end if;
  select count(*) into n from duel_guesses where duel_id = p_duel and profile_id = me;
  if n >= 10 then raise exception 'Du hast schon alle 10 Versuche gebraucht'; end if;
  select code into s from duel_secrets where duel_id = p_duel and profile_id = me;
  for i in 1..4 loop
    if substr(s, i, 1) = substr(p_guess, i, 1) then b := b + 1;
    else cs[substr(s, i, 1)::int + 1] := cs[substr(s, i, 1)::int + 1] + 1; cg[substr(p_guess, i, 1)::int + 1] := cg[substr(p_guess, i, 1)::int + 1] + 1; end if;
  end loop;
  for i in 1..6 loop w := w + least(cs[i], cg[i]); end loop;
  n := n + 1;
  insert into duel_guesses(duel_id, profile_id, n, guess, black, white) values (p_duel, me, n, p_guess, b, w);
  opp := case when me = d.a_profile then d.b_profile else d.a_profile end;
  mfam := case when me = d.a_profile then d.a_family else d.b_family end;
  ofam := case when me = d.a_profile then d.b_family else d.a_family end;
  select count(*) into oppn from duel_guesses where duel_id = p_duel and profile_id = opp;
  if b = 4 then -- geknackt: wer zuerst knackt, gewinnt
    update duels set status = 'done', winner = me, ended_at = now(), updated_at = now() where id = p_duel;
    insert into arcade_scores(family_id, profile_id, game, score, pts) values (mfam, me, 'code', 30, 30), (ofam, opp, 'code', 5, 5);
  elsif n >= 10 and oppn >= 10 then -- beide am Ende, keiner hat geknackt
    update duels set status = 'done', winner = null, ended_at = now(), updated_at = now() where id = p_duel;
    insert into arcade_scores(family_id, profile_id, game, score, pts) values (mfam, me, 'code', 10, 10), (ofam, opp, 'code', 10, 10);
  else
    update duels set updated_at = now() where id = p_duel;
  end if;
  return jsonb_build_object('n', n, 'black', b, 'white', w);
end $$;

create or replace function duel_forfeit(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duels%rowtype; opp uuid; ofam uuid;
begin
  select * into d from duels where id = p_duel for update;
  if not found or me not in (d.a_profile, d.b_profile) then return; end if;
  if d.status = 'invite' then update duels set status = 'cancelled', updated_at = now() where id = p_duel; return; end if;
  if d.status <> 'playing' then return; end if;
  opp := case when me = d.a_profile then d.b_profile else d.a_profile end;
  ofam := case when me = d.a_profile then d.b_family else d.a_family end;
  update duels set status = 'done', winner = opp, ended_at = now(), updated_at = now() where id = p_duel;
  insert into arcade_scores(family_id, profile_id, game, score, pts) values (ofam, opp, 'code', 15, 15);
end $$;

-- Alle paar Sekunden gefragt: Einladungen an mich + mein laufendes Duell
create or replace function duel_poll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r jsonb;
begin
  if me is null then return '{}'::jsonb; end if;
  perform duel_cleanup();
  select jsonb_build_object(
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', p.name, 'family', f.name) order by d.created_at), '[]'::jsonb)
                from duels d join profiles p on p.id = d.a_profile join families f on f.id = d.a_family
                where d.b_profile = me and d.status = 'invite'),
    'active', (select jsonb_build_object('id', d.id, 'status', d.status, 'mine', d.a_profile = me)
               from duels d where me in (d.a_profile, d.b_profile) and d.status in ('invite', 'playing')
               order by d.created_at desc limit 1)) into r;
  return r;
end $$;

create or replace function duel_state(p_duel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duels%rowtype; opp uuid;
begin
  select * into d from duels where id = p_duel;
  if not found or me not in (d.a_profile, d.b_profile) then return null; end if;
  opp := case when me = d.a_profile then d.b_profile else d.a_profile end;
  return jsonb_build_object('id', d.id, 'status', d.status, 'winner', d.winner, 'me', me, 'opp', opp,
    'opp_name', (select p.name from profiles p where p.id = opp),
    'opp_family', (select f.name from profiles p join families f on f.id = p.family_id where p.id = opp),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('n', g.n, 'guess', g.guess, 'black', g.black, 'white', g.white) order by g.n), '[]'::jsonb)
             from duel_guesses g where g.duel_id = d.id and g.profile_id = me),
    'theirs', (select coalesce(jsonb_agg(jsonb_build_object('n', g.n, 'black', g.black, 'white', g.white) order by g.n), '[]'::jsonb)
               from duel_guesses g where g.duel_id = d.id and g.profile_id = opp),
    'my_code', case when d.status = 'done' then (select code from duel_secrets where duel_id = d.id and profile_id = me) end,
    'opp_code', case when d.status = 'done' then (select code from duel_secrets where duel_id = d.id and profile_id = opp) end);
end $$;

/* ---------- Live-Aktualisierung ---------- */
do $$ begin
  begin alter publication supabase_realtime add table flame_state; exception when others then null; end;
  begin alter publication supabase_realtime add table families; exception when others then null; end;
end $$;

/* ---------- Push: Ziel-Reiter und Eintrag mitschicken ---------- */
create or replace function notify_push() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare kind text; actor uuid; ttl text; bdy text; j jsonb := to_jsonb(new); secret text;
begin
  if tg_table_name = 'events' and (to_jsonb(new)->>'meetup_id') is not null then return new; end if;
  select value into secret from push_config where key = 'hook_secret';
  if tg_table_name = 'shopping_items' then kind := 'shop'; actor := null; ttl := '🛒 Einkaufsliste'; bdy := j->>'title';
  elsif tg_table_name = 'tasks' then kind := 'task'; actor := (j->>'created_by')::uuid; ttl := '✅ Neue Aufgabe'; bdy := j->>'title';
  elsif tg_table_name = 'messages' then kind := 'msg'; actor := (j->>'author')::uuid; ttl := '💬 ' || coalesce((select name from profiles where id = actor), 'Chat'); bdy := left(j->>'body', 140);
  else kind := 'event'; actor := (j->>'owner')::uuid; ttl := '📅 Neuer Termin'; bdy := (j->>'title') || ' – ' || to_char((new.starts_at at time zone 'Europe/Berlin'), 'DD.MM. HH24:MI'); end if;
  perform net.http_post(
    url := 'https://wpiqwoprnoasuckrdwlr.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret),
    body := jsonb_build_object('kind', kind, 'family_id', new.family_id, 'actor', actor, 'title', ttl, 'body', bdy, 'item', new.id));
  return new;
exception when others then
  return new; -- Push darf nie das Speichern verhindern
end $$;
