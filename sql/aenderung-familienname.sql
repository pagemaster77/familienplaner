-- Erlaubt dem Ersteller (Admin) der Familie, den Familiennamen zu ändern.
-- Im Supabase SQL Editor einfügen und "Run" drücken.
create policy fam_update_admin on families for update
  using (id = my_family() and exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (id = my_family());
