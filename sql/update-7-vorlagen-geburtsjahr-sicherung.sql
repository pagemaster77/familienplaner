-- Dokumentation (bereits eingespielt): Version 14
-- task_templates (Vorlagen für wiederkehrende Aufgaben), events.birth_year,
-- Funktion spawn_task_templates() + Cron-Jobs spawn-task-templates (stündlich :05),
-- event-reminders (alle 5 Min), weekly-backup (Sonntag 03:20 UTC), privater Storage-Bucket "backups".
alter table public.events add column if not exists birth_year int;
