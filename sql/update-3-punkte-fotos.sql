-- Update 3: Punkte nur durch Admins, Profilfotos
-- Im Supabase SQL Editor komplett einfügen und "Run" drücken.

-- 1) Profilfoto (kleines Bild, wird von der App auf 128x128 verkleinert)
alter table profiles add column if not exists photo text;

-- 2) Wer hat die Aufgabe angelegt?
alter table tasks add column if not exists created_by uuid references profiles(id) on delete set null;

-- 3) Regeln für Aufgaben und Punkte
--    - Nur Admins vergeben Punkte. Aufgaben von Nicht-Admins starten mit 0 Punkten.
--    - Punkte nachträglich ändern dürfen nur Admins.
--    - Wer eine Aufgabe abhakt, wird automatisch als Erledigt-von eingetragen.
create or replace function guard_tasks() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  select coalesce(is_admin, false) into adm from profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if not coalesce(adm, false) then new.points := 0; end if;
    return new;
  end if;
  if not coalesce(adm, false) then new.points := old.points; end if;
  new.created_by := old.created_by;
  if new.done and not old.done then
    new.done_by := auth.uid();
    new.done_at := now();
  elsif not new.done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end $$;

drop trigger if exists guard_tasks_trg on tasks;
create trigger guard_tasks_trg before insert or update on tasks
  for each row execute function guard_tasks();
