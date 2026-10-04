-- Reparatie als soort retour.
-- Alleen toevoegen, idempotent. De code werkt ook zonder deze migratie: een reparatie
-- valt dan terug op een gewone retour met de reparatiegegevens in de toelichting.
--
-- Let op foreign keys: retouren verwijst al naar orders, organisaties en medewerkers.
-- reparatie_factuur_id is daarom een kale uuid zonder FK (net als creditfactuur_id).

-- soort: 'retour' (terugsturen, geld terug of creditnota), 'ruilen' (andere maat of kleur),
-- 'reparatie' (kapot, wij maken het). Geen check-constraint: de code bewaakt de waarden,
-- zodat er later zonder drop een soort bij kan.
alter table public.retouren add column if not exists soort text not null default 'retour';

-- Wat is er kapot: naad, rits, knoop, logo, reflectie, anders.
alter table public.retouren add column if not exists reparatie_onderdeel text;
-- Stappen: aangemeld, ontvangen, in_reparatie, klaar, teruggestuurd, opgehaald.
alter table public.retouren add column if not exists reparatie_status text;
-- Optionele kosten (excl. btw) die op een factuur kunnen.
alter table public.retouren add column if not exists reparatie_kosten numeric(10, 2);
alter table public.retouren add column if not exists reparatie_factuur_id uuid;

create index if not exists retouren_soort_idx on public.retouren (soort);
-- Bestaande omruil-retouren (beslissing 'omruilen') telt de code als 'ruilen'; geen update nodig.
