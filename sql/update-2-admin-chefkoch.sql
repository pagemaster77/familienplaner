-- Update 2: Admin-Rechte, Chat-Nachrichten nur von Admins löschbar, Rezept-Link
-- Im Supabase SQL Editor komplett einfügen und "Run" drücken.

-- 1) Rezept-Link bei Gerichten
alter table meals add column if not exists source_url text;

-- 2) Hilfsfunktion: ist der angemeldete Nutzer Admin seiner Familie?
create or replace function am_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- 3) Schutz: Admin-Status und Familienzugehörigkeit lassen sich nicht mehr direkt ändern
--    (sonst könnte sich jeder selbst zum Admin machen)
create or replace function protect_profile() returns trigger
language plpgsql as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.family_id is distinct from old.family_id)
     and coalesce(current_setting('app.allow_admin_change', true), '') <> 'on' then
    raise exception 'Admin-Rechte können nur über set_admin geändert werden';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_trg on profiles;
create trigger protect_profile_trg before update on profiles
  for each row execute function protect_profile();

-- 4) Admin-Titel vergeben oder entziehen (nur durch Admins der gleichen Familie)
create or replace function set_admin(target uuid, make_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me_fam uuid; me_adm boolean; t_fam uuid;
begin
  select family_id, is_admin into me_fam, me_adm from profiles where id = auth.uid();
  select family_id into t_fam from profiles where id = target;
  if not coalesce(me_adm, false) or me_fam is distinct from t_fam then
    raise exception 'Nur Admins dürfen das';
  end if;
  if not make_admin and (select count(*) from profiles where family_id = me_fam and is_admin) <= 1 then
    raise exception 'Es muss mindestens ein Admin bleiben';
  end if;
  perform set_config('app.allow_admin_change', 'on', true);
  update profiles set is_admin = make_admin where id = target;
end $$;

-- 5) Chat: alle dürfen lesen und schreiben, nur Admins dürfen löschen
drop policy if exists messages_all on messages;
drop policy if exists messages_read on messages;
drop policy if exists messages_insert on messages;
drop policy if exists messages_delete on messages;
create policy messages_read   on messages for select using (family_id = my_family());
create policy messages_insert on messages for insert with check (family_id = my_family() and author = auth.uid());
create policy messages_delete on messages for delete using (family_id = my_family() and am_admin());

-- 6) Familienname ändern: nur Admins (falls aus Update 1 noch nicht vorhanden)
drop policy if exists fam_update_admin on families;
create policy fam_update_admin on families for update
  using (id = my_family() and am_admin())
  with check (id = my_family());
