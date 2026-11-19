-- Abgesagte Treffen endgueltig loeschen (nur Veranstalter oder Admin der Veranstalter-Familie)
create or replace function public.delete_meetup(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare m meetups;
begin
  select * into m from meetups where id = p_id for update;
  if m.id is null then raise exception 'Treffen nicht gefunden'; end if;
  if m.status <> 'cancelled' then raise exception 'Nur abgesagte Treffen können gelöscht werden'; end if;
  if not (auth.uid() = m.from_profile or (am_admin() and my_family() = m.from_family)) then raise exception 'Nur der Veranstalter kann das'; end if;
  delete from meetups where id = p_id; -- Einladungen und Kalendereintraege laufen per CASCADE mit
end $$;
revoke all on function public.delete_meetup(uuid) from public, anon;
grant execute on function public.delete_meetup(uuid) to authenticated;
