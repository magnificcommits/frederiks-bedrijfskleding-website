-- =============================================================================
-- Testdata opruimen (handmatig draaien, NIET als migratie)
-- Gemaakt 2026-10-04 door de QA-ronde; geïnventariseerd op de productiedatabase.
--
-- Zo gebruik je dit bestand (Supabase > SQL Editor):
--   1. Draai eerst alleen DEEL 1 (de SELECTs). Controleer per regel of het echt
--      testdata is. Klopt een regel niet, haal dan het bijbehorende DELETE weg.
--   2. Draai daarna DEEL 2. Dat staat in één transactie en eindigt met ROLLBACK:
--      je ziet hoeveel rijen er weg zouden gaan, zonder dat er iets verandert.
--   3. Tevreden? Vervang de laatste regel ROLLBACK door COMMIT en draai DEEL 2 opnieuw.
--
-- Alles gaat op vaste id's (geen "naam like 'TEST%'"), zodat er nooit iets
-- meegaat dat later is aangemaakt met een vergelijkbare naam.
--
-- BEWUST NIET OPGENOMEN (twijfel, eerst navragen):
--   * Organisatie "TEST TIm" (e0aad19b-…): Tims eigen testorganisatie met 1 lead
--     en 1 contactpersoon. Volgens de opdracht blijven Tims testaccounts staan.
--   * Bouwbedrijf Wassink zelf, de medewerkers daar, de 3 portaalaccounts van
--     Tim (tim.sebastiaan.dejong[+medewerker|+leidinggevende]@gmail.com) en de
--     assortimentregels van 16 juni (Werkbroek, Veiligheidsschoenen S3).
--   * Campagne "Opvolging na QR-scan" (7c121d26-…): er is maar één exemplaar
--     (geen kopie), aangemaakt op 4 oktober met een volledige flow. Mogelijk is
--     dit het echte sjabloon van Jessi. Staat hieronder uitgecommentarieerd.
--   * Demo (voorbeeldklant) zelf, de portaalaccounts info+…@frederiksbedrijfskleding.nl,
--     "Demo Medewerker" en het assortiment van 28 juni: dat is de vaste demo-inrichting.
--   * Demo: afdeling "Lassers" en assortimentregel "Softshell Jas Gevoerd" (2 oktober).
--     Aangemaakt in dezelfde testsessie als "Test Boekhouding", maar kunnen ook
--     bewust aan de demo zijn toegevoegd. Uitgecommentarieerd.
--   * Nieuwsbrief "Frederiks Bedrijfskleding basis": dat is het basissjabloon.
--   * Facturen: geen enkele factuur is als test herkenbaar; facturen blijven altijd staan.
-- =============================================================================


-- =============================================================================
-- DEEL 1: wat er weg zou gaan (alleen lezen)
-- =============================================================================

-- 1a. TEST-afdelingen bij Bouwbedrijf Wassink, plus de assortimentregels die
--     eraan hangen (die verdwijnen via ON DELETE CASCADE). Medewerkers die aan
--     zo'n afdeling hangen blijven bestaan; hun afdeling wordt leeg (SET NULL).
select 'afdeling' as soort, a.id, a.naam, a.created_at
from public.afdelingen a
where a.id in ('7d72f5c9-63b4-4a07-925b-062eae371551', '2c857ad3-ac42-4ca4-8bf5-119eeb36721d')
union all
select 'assortiment (cascade)', s.id, coalesce(p.naam, '?') || ' / ' || coalesce(s.kleur, '-'), s.created_at
from public.assortiment s
left join public.producten p on p.id = s.product_id
where s.afdeling_id in ('7d72f5c9-63b4-4a07-925b-062eae371551', '2c857ad3-ac42-4ca4-8bf5-119eeb36721d')
union all
select 'medewerker (afdeling wordt leeg)', m.id, coalesce(m.naam, ''), m.created_at
from public.medewerkers m
where m.afdeling_id in ('7d72f5c9-63b4-4a07-925b-062eae371551', '2c857ad3-ac42-4ca4-8bf5-119eeb36721d');

-- 1b. Organisatie "TEST Wizard Installatie (Claude)" met alles wat eraan hangt
--     (medewerkers, afdelingen, contactpersoon gaan mee via CASCADE).
select o.id, o.naam, o.created_at,
  (select count(*) from public.medewerkers where organisatie_id = o.id) as medewerkers,
  (select count(*) from public.afdelingen where organisatie_id = o.id) as afdelingen,
  (select count(*) from public.contactpersonen where organisatie_id = o.id) as contactpersonen,
  (select count(*) from public.orders where organisatie_id = o.id) as orders_moet_0_zijn,
  (select count(*) from public.facturen where organisatie_id = o.id) as facturen_moet_0_zijn
from public.organisaties o
where o.id = '54dab737-503f-4dc3-b007-4e098903ddfb';

-- 1c. TEST-nieuwsbrief.
select id, naam, onderwerp, status, created_at
from public.nieuwsbrieven
where id = '5773ae46-6ad4-4eb5-832b-04d199b55754';

-- 1d. Campagnes: drie lege "winterjassen"-concepten (binnen 11 seconden aangemaakt,
--     dubbelklik) en de lege campagne "TEST". Geen stappen, inschrijvingen of verzendingen.
select c.id, c.naam, c.status, c.created_at,
  (select count(*) from public.campagne_inschrijvingen i where i.campagne_id = c.id) as inschrijvingen,
  (select count(*) from public.campagne_verzendingen v where v.campagne_id = c.id) as verzendingen
from public.campagnes c
where c.id in (
  '1b75481a-f9fa-4585-b560-4d8e41aa41ca',
  '45ee7533-4f31-4a53-b106-9059bf32b481',
  '49ab2faf-17b0-49d6-a68f-bc010c1acc1f',
  '5ebe87d8-9b49-4a0c-af8a-f88f81a4f37c'
);

-- 1e. Testprospect "TEST Installatiebedrijf (Claude)" (bron 'test', geen brief, geen scans).
select id, bedrijfsnaam, bron, status, created_at, aantal_scans
from public.prospecten
where id = '0dfbfdc3-df1a-4d61-8619-461090735a95';

-- 1f. Demo (voorbeeldklant): lege order #1004, conceptofferte #5, de testcontactpersoon
--     en -medewerker "Test Boekhouding", en de twee testtaken van 3 oktober.
--     De taak bij order #1004 gaat ook mee via ON DELETE CASCADE.
select 'order' as soort, o.id, o.ordernummer::text as nummer, o.status, o.created_at,
  (select count(*) from public.orderregels r where r.order_id = o.id) as regels
from public.orders o where o.id = 'bc53f17f-ea6c-4685-80d4-470ea630e0f8'
union all
select 'offerte', f.id, f.offertenummer::text, f.status, f.created_at,
  (select count(*) from public.offerteregels r where r.offerte_id = f.id)
from public.offertes f where f.id = '3b38e156-9427-4c9c-bc35-e73ba0dc1526'
union all
select 'taak', t.id, t.titel, t.status, t.created_at, null
from public.taken t where t.id in ('ebfe898d-fd0b-40ef-aeb4-a476d54bbfc9', '646f99b4-4c33-4b62-963e-dd8551128dcf')
union all
select 'contactpersoon', c.id, c.naam, coalesce(c.email, ''), c.created_at, null
from public.contactpersonen c where c.id = '22efa6ce-322f-4c88-b5a3-1871c14b0a66'
union all
select 'medewerker', m.id, coalesce(m.naam, ''), '', m.created_at, null
from public.medewerkers m where m.id = 'f519c0c7-a26f-477f-9f74-032f28194573';

-- Controle: hangt er nog iets aan order #1004 of offerte #5 (moet allemaal 0 zijn)?
select
  (select count(*) from public.facturen where order_id = 'bc53f17f-ea6c-4685-80d4-470ea630e0f8') as facturen_bij_order,
  (select count(*) from public.drukproeven where order_id = 'bc53f17f-ea6c-4685-80d4-470ea630e0f8') as drukproeven_bij_order,
  (select count(*) from public.orders where offerte_id = '3b38e156-9427-4c9c-bc35-e73ba0dc1526') as orders_uit_offerte;


-- =============================================================================
-- DEEL 2: verwijderen (in één transactie; staat standaard op ROLLBACK)
-- =============================================================================
begin;

-- 2a. TEST-afdelingen bij Bouwbedrijf Wassink (assortiment op die afdelingen gaat mee).
delete from public.afdelingen
where id in ('7d72f5c9-63b4-4a07-925b-062eae371551', '2c857ad3-ac42-4ca4-8bf5-119eeb36721d')
  and organisatie_id = '14b0ec58-db19-4b37-9086-464d0fcd4793'
  and naam like 'TEST %';

-- 2b. TEST Wizard-organisatie. Faalt bewust (RESTRICT) als er inmiddels orders of facturen aan hangen.
delete from public.organisaties
where id = '54dab737-503f-4dc3-b007-4e098903ddfb'
  and naam = 'TEST Wizard Installatie (Claude)';

-- 2c. TEST-nieuwsbrief.
delete from public.nieuwsbrieven
where id = '5773ae46-6ad4-4eb5-832b-04d199b55754'
  and naam = 'TEST Claude nieuwsbrief'
  and status = 'concept';

-- 2d. Lege campagneconcepten.
delete from public.campagnes
where id in (
    '1b75481a-f9fa-4585-b560-4d8e41aa41ca',
    '45ee7533-4f31-4a53-b106-9059bf32b481',
    '49ab2faf-17b0-49d6-a68f-bc010c1acc1f',
    '5ebe87d8-9b49-4a0c-af8a-f88f81a4f37c'
  )
  and status = 'concept'
  and not exists (select 1 from public.campagne_verzendingen v where v.campagne_id = campagnes.id);

-- Twijfel, alleen na navragen bij Jessi:
-- delete from public.campagnes
-- where id = '7c121d26-1b94-4c9f-a412-6f8693d6d386' and naam = 'Opvolging na QR-scan' and status = 'concept'
--   and not exists (select 1 from public.campagne_verzendingen v where v.campagne_id = campagnes.id);

-- 2e. Testprospect (bezoeken, brief_ontvangers en campagne-inschrijvingen gaan mee via CASCADE).
delete from public.prospecten
where id = '0dfbfdc3-df1a-4d61-8619-461090735a95'
  and bron = 'test';

-- 2f. Demo (voorbeeldklant): testitems. Eerst de losse taak, dan de order (de ordertaak
--     gaat mee via CASCADE), de offerte (regels via CASCADE), contactpersoon en medewerker.
delete from public.taken
where id in ('646f99b4-4c33-4b62-963e-dd8551128dcf', 'ebfe898d-fd0b-40ef-aeb4-a476d54bbfc9')
  and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c';

delete from public.orders
where id = 'bc53f17f-ea6c-4685-80d4-470ea630e0f8'
  and ordernummer = 1004
  and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c'
  and status = 'concept'
  and not exists (select 1 from public.orderregels r where r.order_id = orders.id)
  and not exists (select 1 from public.facturen f where f.order_id = orders.id);

delete from public.offertes
where id = '3b38e156-9427-4c9c-bc35-e73ba0dc1526'
  and offertenummer = 5
  and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c'
  and status = 'concept';

delete from public.contactpersonen
where id = '22efa6ce-322f-4c88-b5a3-1871c14b0a66'
  and naam = 'Test Boekhouding'
  and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c';

delete from public.medewerkers
where id = 'f519c0c7-a26f-477f-9f74-032f28194573'
  and naam = 'Test Boekhouding'
  and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c';

-- Twijfel, alleen na navragen:
-- delete from public.afdelingen where id = 'd15f893e-8c15-4cf0-8b61-19769ba15b7f' and naam = 'Lassers'
--   and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c';
-- delete from public.assortiment where id = 'fe7337a5-e33d-4648-bdb5-05ee97841536'
--   and organisatie_id = '5598fc69-0a86-4545-9185-bcbc3cc9154c';

-- Vervang ROLLBACK door COMMIT als de aantallen hierboven kloppen.
rollback;
