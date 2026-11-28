-- Update 26 (als Migration "farbwelt_pro_person" eingespielt): jede Person waehlt ihre App-Farbwelt selbst.
-- NULL = noch nicht gewaehlt -> es gilt die bisherige Familien-Farbwelt (families.theme) als Vorgabe.
-- Aendern darf jeder nur sein eigenes Profil (bestehende Regel prof_update_self).
alter table profiles add column if not exists theme text;
alter table profiles drop constraint if exists profiles_theme_chk;
alter table profiles add constraint profiles_theme_chk check (theme is null or theme in ('standard','spinne','eisen','gold','bronze','ozean'));
