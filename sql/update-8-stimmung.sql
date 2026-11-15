-- Dokumentation (bereits eingespielt): Version 15 Stimmung
alter table public.profiles add column if not exists mood text check (mood in ('good','neutral','bad','help')), add column if not exists mood_at timestamptz;
-- Trigger push_help: bei mood='help' Push "🆘 NAME möchte reden" an alle anderen (Funktion notify_help)

-- Update 15.4 (15.11.2026): Punkte fuer Stimmung. Bereits eingespielt (Migration "stimmung_punkte").
-- profiles.mood_points_at = Zeitpunkt der letzten Gutschrift. Trigger mood_award_trg (BEFORE UPDATE):
-- 5 Punkte (point_log kind 'mood') beim Eintragen einer Stimmung, hoechstens 1x in 24 Std.; 'help' gibt keine Punkte.
-- Der Client kann mood_points_at nicht selbst aendern (Trigger setzt den alten Wert zurueck).
