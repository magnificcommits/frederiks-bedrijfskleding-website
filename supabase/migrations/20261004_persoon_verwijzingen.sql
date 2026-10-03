-- Persoonsvelden verwijzen naar vooraf aangemaakte personen, zodat je altijd
-- op die persoon kunt filteren en zoeken. De bestaande tekstkolommen blijven
-- en worden gevuld met de naam (weergave, oude code, portaalbestellingen die er
-- het e-mailadres van de besteller in zetten).
--
-- Alleen toevoegen, idempotent. De app werkt ook zonder deze migratie: dan
-- wordt alleen de naam opgeslagen.

-- Orders: wie vroeg de order aan (contactpersoon of werknemer van de klant).
alter table public.orders
  add column if not exists aangevraagd_door_contact_id uuid references public.contactpersonen(id) on delete set null,
  add column if not exists aangevraagd_door_medewerker_id uuid references public.medewerkers(id) on delete set null;

create index if not exists orders_aangevraagd_door_contact_idx
  on public.orders (aangevraagd_door_contact_id) where aangevraagd_door_contact_id is not null;
create index if not exists orders_aangevraagd_door_medewerker_idx
  on public.orders (aangevraagd_door_medewerker_id) where aangevraagd_door_medewerker_id is not null;

-- Orders: wie keurde goed of af (bij goedkeuring via het dashboard).
alter table public.orders
  add column if not exists goedgekeurd_door_contact_id uuid references public.contactpersonen(id) on delete set null,
  add column if not exists goedgekeurd_door_medewerker_id uuid references public.medewerkers(id) on delete set null;

create index if not exists orders_goedgekeurd_door_contact_idx
  on public.orders (goedgekeurd_door_contact_id) where goedgekeurd_door_contact_id is not null;
create index if not exists orders_goedgekeurd_door_medewerker_idx
  on public.orders (goedgekeurd_door_medewerker_id) where goedgekeurd_door_medewerker_id is not null;

-- Klantactiviteiten: welke collega van Frederiks (taak_personen).
alter table public.klant_activiteiten
  add column if not exists door_persoon_id uuid references public.taak_personen(id) on delete set null;

create index if not exists klant_activiteiten_door_persoon_idx
  on public.klant_activiteiten (door_persoon_id) where door_persoon_id is not null;

-- Afdelingen: leidinggevende is een werknemer van de klant.
alter table public.afdelingen
  add column if not exists leidinggevende_medewerker_id uuid references public.medewerkers(id) on delete set null;

create index if not exists afdelingen_leidinggevende_medewerker_idx
  on public.afdelingen (leidinggevende_medewerker_id) where leidinggevende_medewerker_id is not null;

-- Bestaande rijen met alleen tekst blijven zoals ze zijn. Het dashboard koppelt
-- die bij het tonen op naam of e-mailadres binnen de klant; bij de eerstvolgende
-- keer opslaan wordt het id vastgelegd. Het orderfilter zoekt ook op de tekst.

-- PostgREST het nieuwe schema laten zien.
notify pgrst, 'reload schema';
