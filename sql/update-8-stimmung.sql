-- Dokumentation (bereits eingespielt): Version 15 Stimmung
alter table public.profiles add column if not exists mood text check (mood in ('good','neutral','bad','help')), add column if not exists mood_at timestamptz;
-- Trigger push_help: bei mood='help' Push "🆘 NAME möchte reden" an alle anderen (Funktion notify_help)
