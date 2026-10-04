-- HANDMATIG UITVOEREN (Supabase SQL-editor). Niet als automatische migratie:
-- de check constraint moet eerst weg om een waarde toe te voegen.
--
-- Waarom: online geboekte afspraken (/afspraak) maken een lead met
-- bron_kanaal = 'afspraak'. De huidige constraint (migratie
-- 20261006_weblead_inname) kent die waarde nog niet. Tot deze SQL draait, valt
-- de code terug op bron_kanaal leeg en bron = 'afspraak | ...'; er gaat dus
-- niets mis, alleen filteren op kanaal werkt dan niet voor afspraken.
--
-- Let op: draait de leads-agent ook een uitbreiding van deze lijst, neem dan
-- de waarden van beide over in één constraint.

begin;

alter table public.leads drop constraint if exists leads_bron_kanaal_chk;

alter table public.leads add constraint leads_bron_kanaal_chk
  check (bron_kanaal is null or bron_kanaal in (
    'formulier', 'configurator', 'selectie', 'kennismaking', 'telefoon', 'handmatig', 'afspraak'
  ));

commit;
