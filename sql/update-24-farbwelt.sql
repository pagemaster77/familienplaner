-- Update 24 (bereits eingespielt als Migration "farbwelt_familie"): Farbwelt pro Familie
alter table families add column if not exists theme text not null default 'standard';
alter table families drop constraint if exists families_theme_chk;
alter table families add constraint families_theme_chk check (theme in ('standard','spinne','eisen','gold','bronze','ozean'));
