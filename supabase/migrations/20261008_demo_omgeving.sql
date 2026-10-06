-- Ronde 15: één centrale demo-omgeving.
--
-- * organisaties.is_demo markeert de demoklant. Er is er precies één.
-- * demo_reset() zet de demoklant terug in een vaste begintoestand: tien werknemers
--   in drie afdelingen, vier orders (geleverd, gefactureerd, in bedrukking, wacht op
--   goedkeuring), twee facturen, meldingen en een drukproef die klaarstaat.
-- * Alleen de service-role mag de functie aanroepen (vanuit het KMS, na de login-check).
-- Idempotent: opnieuw draaien kan zonder schade. Deze migratie verwijdert zelf niets.

alter table public.organisaties add column if not exists is_demo boolean not null default false;
create unique index if not exists organisaties_een_demo on public.organisaties (is_demo) where is_demo;

-- De bestaande demoklant wordt de centrale demo.
update public.organisaties set is_demo = true
where naam in ('Demo (voorbeeldklant)', 'Demo Bouwbedrijf')
  and not exists (select 1 from public.organisaties where is_demo);

-- Login voor de leidinggevende erbij (werkgever en werknemer bestaan al).
insert into public.portaal_gebruikers (organisatie_id, email, naam, rol)
select id, 'info+leidinggevende@frederiksbedrijfskleding.nl', 'Mark Jansen', 'leidinggevende'
from public.organisaties o where o.is_demo
  and not exists (select 1 from public.portaal_gebruikers g where lower(g.email) = 'info+leidinggevende@frederiksbedrijfskleding.nl');

create or replace function public.demo_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  a_uit uuid; a_ins uuid; a_kan uuid;
  m record;
  mw jsonb := '{}'::jsonb;
  o_oud uuid; o_open uuid; o_druk uuid; o_wacht uuid;
  f uuid;
  nieuw uuid;
  prijs_broek numeric; prijs_shirt numeric; prijs_soft numeric; prijs_hoodie numeric; prijs_jas numeric; prijs_knie numeric;
  p_broek uuid; p_shirt uuid; p_soft uuid; p_hoodie uuid; p_jas uuid; p_knie uuid;
begin
  select id into org from organisaties where is_demo limit 1;
  if org is null then raise exception 'Geen demoklant (organisaties.is_demo)'; end if;

  -- 1. Oude demo-inhoud weg. FK's op orders/medewerkers/afdelingen zijn cascade of set null.
  delete from facturen where organisatie_id = org;
  delete from orders where organisatie_id = org;
  delete from portaal_bestellingen where organisatie_id = org;
  delete from portaal_meldingen where organisatie_id = org;
  delete from medewerker_verzoeken where organisatie_id = org;
  delete from retouren where organisatie_id = org;
  delete from klachten where organisatie_id = org;
  delete from favorieten where organisatie_id = org;
  update portaal_gebruikers set medewerker_id = null where organisatie_id = org;
  delete from medewerkers where organisatie_id = org;
  delete from afdelingen where organisatie_id = org;
  delete from functies where organisatie_id = org;

  -- 2. Klantgegevens.
  update organisaties set
    naam = 'Demo Bouwbedrijf', plaats = 'Doetinchem', adres = 'Voorbeeldweg 1', postcode = '7000 AA',
    contactpersoon = 'Linda Meijer', functie_contactpersoon = 'Officemanager',
    goedkeuren_bestellingen = true, budget_actief = true, levering = 'per_werknemer', retouren_actief = true,
    actief = true, opmerkingen = 'Demoklant. Wordt teruggezet met de knop Demo resetten.'
  where id = org;

  -- 3. Afdelingen, functies, werknemers.
  insert into afdelingen (organisatie_id, naam, kostenplaats) values (org, 'Uitvoering', 'KP-100') returning id into a_uit;
  insert into afdelingen (organisatie_id, naam, kostenplaats) values (org, 'Installatie', 'KP-200') returning id into a_ins;
  insert into afdelingen (organisatie_id, naam, kostenplaats) values (org, 'Kantoor', 'KP-900') returning id into a_kan;
  insert into functies (organisatie_id, naam) values
    (org, 'Uitvoerder'), (org, 'Timmerman'), (org, 'Grondwerker'), (org, 'Monteur'), (org, 'Projectleider'), (org, 'Officemanager'), (org, 'Calculator'), (org, 'Planner');

  for m in select * from (values
    ('Mark', 'Jansen', 'Uitvoerder', a_uit, 450, 'P001'),
    ('Sander', 'Wolters', 'Timmerman', a_uit, 450, 'P002'),
    ('Kevin', 'Bos', 'Timmerman', a_uit, 450, 'P003'),
    ('Lars', 'Peters', 'Grondwerker', a_uit, 450, 'P004'),
    ('Eva', 'Hendriks', 'Projectleider', a_ins, 350, 'P005'),
    ('Tom', 'de Vries', 'Monteur', a_ins, 450, 'P006'),
    ('Bram', 'Smit', 'Monteur', a_ins, 450, 'P007'),
    ('Linda', 'Meijer', 'Officemanager', a_kan, 250, 'P008'),
    ('Joost', 'van Dam', 'Calculator', a_kan, 250, 'P009'),
    ('Anouk', 'Visser', 'Planner', a_kan, 250, 'P010')
  ) as t(voornaam, achternaam, functie, afdeling, budget, pnr)
  loop
    insert into medewerkers (organisatie_id, naam, voornaam, achternaam, functie, afdeling_id, budget, startbudget, personeelsnummer, datum_in_dienst, actief, bron)
    values (org, m.voornaam || ' ' || m.achternaam, m.voornaam, m.achternaam, m.functie, m.afdeling, m.budget, m.budget, m.pnr, current_date - 400, true, 'handmatig')
    returning id into nieuw;
    mw := mw || jsonb_build_object(m.voornaam, nieuw);
  end loop;

  update afdelingen set leidinggevende = 'Mark Jansen', leidinggevende_medewerker_id = (mw->>'Mark')::uuid where id = a_uit;
  update afdelingen set leidinggevende = 'Eva Hendriks', leidinggevende_medewerker_id = (mw->>'Eva')::uuid where id = a_ins;

  -- 4. Logins aan de juiste werknemer koppelen.
  update portaal_gebruikers set medewerker_id = (mw->>'Sander')::uuid, naam = 'Sander Wolters'
    where organisatie_id = org and rol = 'medewerker';
  update portaal_gebruikers set medewerker_id = (mw->>'Mark')::uuid, naam = 'Mark Jansen'
    where organisatie_id = org and rol = 'leidinggevende';
  update portaal_gebruikers set naam = 'Linda Meijer'
    where organisatie_id = org and rol = 'beheerder' and email like 'info+beheerder@%';

  -- 5. Assortiment aanvullen met een werkbroek en een T-shirt als die ontbreken (met foto).
  insert into assortiment (organisatie_id, product_id, toegestaan)
  select org, p.id, true from (
    select distinct on (categorie) id, categorie from producten
    where actief and categorie in ('Broeken', 'T-shirts & polo''s') and afbeeldingen is not null
    order by categorie, naam
  ) p
  where not exists (select 1 from assortiment a join producten q on q.id = a.product_id where a.organisatie_id = org and q.categorie = p.categorie);

  select p.id, coalesce(p.verkoopprijs_basis, 79) into p_broek, prijs_broek from assortiment a join producten p on p.id = a.product_id where a.organisatie_id = org and p.categorie = 'Broeken' limit 1;
  select p.id, coalesce(p.verkoopprijs_basis, 19) into p_shirt, prijs_shirt from assortiment a join producten p on p.id = a.product_id where a.organisatie_id = org and p.categorie = 'T-shirts & polo''s' limit 1;
  select p.id, coalesce(p.verkoopprijs_basis, 89) into p_soft, prijs_soft from assortiment a join producten p on p.id = a.product_id where a.organisatie_id = org and p.naam ilike '%softshell jas%' limit 1;
  select p.id, coalesce(p.verkoopprijs_basis, 59) into p_hoodie, prijs_hoodie from assortiment a join producten p on p.id = a.product_id where a.organisatie_id = org and p.naam ilike '%hoodie%' limit 1;
  select p.id, coalesce(p.verkoopprijs_basis, 129) into p_jas, prijs_jas from assortiment a join producten p on p.id = a.product_id where a.organisatie_id = org and p.naam ilike '%hardshell%' limit 1;
  select p.id, coalesce(p.verkoopprijs_basis, 25) into p_knie, prijs_knie from assortiment a join producten p on p.id = a.product_id where a.organisatie_id = org and p.naam ilike '%kniebescherm%' limit 1;
  prijs_broek := coalesce(prijs_broek, 79); prijs_shirt := coalesce(prijs_shirt, 19); prijs_soft := coalesce(prijs_soft, 89);
  prijs_hoodie := coalesce(prijs_hoodie, 59); prijs_jas := coalesce(prijs_jas, 129); prijs_knie := coalesce(prijs_knie, 25);

  -- 6. Orders: oud en betaald, geleverd en open gefactureerd, in bedrukking, wacht op goedkeuring.
  insert into orders (organisatie_id, medewerker_id, afdeling_id, besteldatum, status, goedkeuring_status, bedrag, aangevraagd_door, bron)
  values (org, (mw->>'Lars')::uuid, a_uit, now() - interval '92 days', 'compleet_geleverd', 'niet_nodig', 2 * prijs_broek + 3 * prijs_shirt, 'Linda Meijer', 'handmatig')
  returning id into o_oud;
  insert into orderregels (order_id, product_id, item_naam, maat, aantal, stukprijs) values
    (o_oud, p_broek, 'Werkbroek', '52', 2, prijs_broek), (o_oud, p_shirt, 'T-shirt met logo', 'L', 3, prijs_shirt);

  insert into orders (organisatie_id, medewerker_id, afdeling_id, besteldatum, status, goedkeuring_status, goedgekeurd_door, bedrag, aangevraagd_door, bron)
  values (org, (mw->>'Kevin')::uuid, a_uit, now() - interval '41 days', 'compleet_geleverd', 'goedgekeurd', 'Mark Jansen', 2 * prijs_broek + 3 * prijs_shirt + prijs_soft, 'Kevin Bos', 'portaal')
  returning id into o_open;
  insert into orderregels (order_id, product_id, item_naam, maat, aantal, stukprijs) values
    (o_open, p_broek, 'Werkbroek', '50', 2, prijs_broek), (o_open, p_shirt, 'T-shirt met logo', 'M', 3, prijs_shirt), (o_open, p_soft, 'Softshell jas', 'M', 1, prijs_soft);

  insert into orders (organisatie_id, medewerker_id, afdeling_id, besteldatum, status, goedkeuring_status, goedgekeurd_door, bedrag, aangevraagd_door, bron)
  values (org, (mw->>'Tom')::uuid, a_ins, now() - interval '5 days', 'bedrukken', 'goedgekeurd', 'Eva Hendriks', prijs_soft + prijs_hoodie, 'Tom de Vries', 'portaal')
  returning id into o_druk;
  insert into orderregels (order_id, product_id, item_naam, maat, aantal, stukprijs) values
    (o_druk, p_soft, 'Softshell jas', 'L', 1, prijs_soft), (o_druk, p_hoodie, 'Hoodie met logo', 'L', 1, prijs_hoodie);

  insert into orders (organisatie_id, medewerker_id, afdeling_id, besteldatum, status, goedkeuring_status, bedrag, aangevraagd_door, aangevraagd_door_medewerker_id, notitie, bron)
  values (org, (mw->>'Sander')::uuid, a_uit, now() - interval '1 day', 'concept', 'wacht', prijs_jas + prijs_knie, 'Sander Wolters', (mw->>'Sander')::uuid, 'Mijn oude jas is gescheurd.', 'portaal')
  returning id into o_wacht;
  insert into orderregels (order_id, product_id, item_naam, maat, aantal, stukprijs) values
    (o_wacht, p_jas, 'Jas hardshell', 'L', 1, prijs_jas), (o_wacht, p_knie, 'Kniebeschermers', null, 1, prijs_knie);

  -- 7. Facturen: de oude betaald, de recente open.
  insert into facturen (organisatie_id, order_id, factuurdatum, vervaldatum, bedrag_excl, btw_bedrag, bedrag_incl, status, betaaldatum)
  select org, o_oud, (now() - interval '90 days')::date, (now() - interval '60 days')::date, bedrag, round(bedrag * 0.21, 2), round(bedrag * 1.21, 2), 'betaald', (now() - interval '70 days')::date
  from orders where id = o_oud returning id into f;
  insert into factuurregels (factuur_id, omschrijving, aantal, stukprijs, bedrag, product_id, positie)
  select f, item_naam || coalesce(' maat ' || maat, ''), aantal, stukprijs, aantal * stukprijs, product_id, row_number() over () from orderregels where order_id = o_oud;

  insert into facturen (organisatie_id, order_id, factuurdatum, vervaldatum, bedrag_excl, btw_bedrag, bedrag_incl, status)
  select org, o_open, (now() - interval '20 days')::date, (now() + interval '10 days')::date, bedrag, round(bedrag * 0.21, 2), round(bedrag * 1.21, 2), 'verzonden'
  from orders where id = o_open returning id into f;
  insert into factuurregels (factuur_id, omschrijving, aantal, stukprijs, bedrag, product_id, positie)
  select f, item_naam || coalesce(' maat ' || maat, ''), aantal, stukprijs, aantal * stukprijs, product_id, row_number() over () from orderregels where order_id = o_open;

  -- 8. Meldingen en drukproef.
  insert into portaal_meldingen (organisatie_id, medewerker_id, tekst) values
    (org, (mw->>'Tom')::uuid, 'Je bestelling wordt nu bedrukt. Je hoort het zodra hij onderweg is.'),
    (org, null, 'Sander Wolters vraagt een nieuwe jas en kniebeschermers aan. Dit wacht op goedkeuring.');
  update drukproeven set status = 'verstuurd' where organisatie_id = org;
end;
$$;

revoke all on function public.demo_reset() from public, anon, authenticated;
grant execute on function public.demo_reset() to service_role;

-- De eerste vulling gebeurt via de knop Demo resetten in het KMS (of: select public.demo_reset();).
