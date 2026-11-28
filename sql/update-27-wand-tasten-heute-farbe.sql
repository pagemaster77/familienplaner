-- Update 27 (als Migration "wand_tasten_heute_farbe" eingespielt): frei waehlbare Farbe fuer die Tasten und den heutigen Tag der Wandanzeige
-- NULL = Vorgabe der Farbwelt. Format: #rrggbb (klein geschrieben)
alter table families add column if not exists wall_btn_color text, add column if not exists wall_today_color text;
alter table families drop constraint if exists families_wall_colors_chk;
alter table families add constraint families_wall_colors_chk check ((wall_btn_color is null or wall_btn_color ~ '^#[0-9a-f]{6}$') and (wall_today_color is null or wall_today_color ~ '^#[0-9a-f]{6}$'));
