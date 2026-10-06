-- Ronde 20: tijdstip van de laatste webaanvraag op een lead. Komt dezelfde klant binnen
-- 7 dagen opnieuw, dan wordt de open lead bijgewerkt in plaats van een tweede lead.
-- Met deze kolom toont het KMS "Opnieuw aangevraagd, 5 min geleden" in plaats van de
-- datum van de eerste aanvraag. Niets wordt verwijderd.
alter table public.leads add column if not exists laatste_aanvraag_op timestamptz;
