-- Update 21: Wiederkehrende Aufgaben mit Wochentagen + Anzeige im Kalender
-- (bereits in Supabase eingespielt als Migration "wiederkehrende_aufgaben_wochentage")
alter table task_templates add column if not exists weekdays int[] not null default '{}';  -- 1=Mo ... 7=So
alter table task_templates add column if not exists cal_for uuid[] not null default '{}';  -- Personen, in deren Kalender die Aufgabe erscheint
-- rhythm darf jetzt auch 'days' sein; spawn_task_templates() legt die Aufgaben an den gewaehlten Wochentagen an
-- (stuendlich :05 per Cron 'spawn-task-templates', erst ab 06:00 Berlin). notify_push() ueberspringt Vorlagen-Aufgaben.
do $$ begin alter publication supabase_realtime add table task_templates; exception when others then null; end $$;
