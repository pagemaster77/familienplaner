-- Update 25 (als Migration "wand_farbwelt" eingespielt): eigene Farbwelt fuer die Wandanzeige
-- 'standard' = die bisherige helle Wandanzeige, die anderen wie in der App (dunkel)
alter table families add column if not exists wall_theme text not null default 'standard';
alter table families drop constraint if exists families_wall_theme_chk;
alter table families add constraint families_wall_theme_chk check (wall_theme in ('standard','spinne','eisen','gold','bronze','ozean'));
