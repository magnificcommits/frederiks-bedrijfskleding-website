-- Herstel na 20261004_persoon_verwijzingen: de foreign keys op de nieuwe
-- werknemer-kolommen van orders maakten de bestaande embed orders -> medewerkers(naam)
-- dubbelzinnig (PGRST201). De kolommen blijven bestaan, alleen de FK gaat eraf.
alter table public.orders drop constraint if exists orders_aangevraagd_door_medewerker_id_fkey;
alter table public.orders drop constraint if exists orders_goedgekeurd_door_medewerker_id_fkey;
notify pgrst, 'reload schema';
