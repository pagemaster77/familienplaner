-- Version 21.0: Chat mit zwei Raeumen. scope 'family' = nur eigene Familie, 'all' = alle verbundenen Familien.
alter table messages add column if not exists scope text not null default 'family' check (scope in ('family','all'));
drop policy if exists messages_read on messages;
drop policy if exists messages_insert on messages;
create policy messages_read on messages for select using (
  (scope = 'family' and family_id = my_family())
  or (scope = 'all' and (family_id = my_family() or family_id in (select linked_families())))
);
create policy messages_insert on messages for insert with check (family_id = my_family() and author = auth.uid() and scope in ('family','all'));
