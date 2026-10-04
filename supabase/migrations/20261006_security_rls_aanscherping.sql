-- =============================================================================
-- Security-audit oktober 2026: RLS aanscherpen (additief).
-- Zie docs/security-audit-2026-10.md voor bevindingen en testbewijs.
--
-- Alleen ADDITIEVE wijzigingen: nieuwe RESTRICTIVE policies (die worden ge-AND-d met
-- de bestaande permissive policies, dus ze kunnen alleen toegang wegnemen, nooit
-- geven) en `create or replace function` met vaste search_path.
-- Het dashboard (KMS) gebruikt de service-role en merkt hier niets van.
--
-- Rollback per blok staat erbij (policy verwijderen / vorige functietekst terugzetten).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOK 1: portaalrechten koppelen aan een BEVESTIGD e-mailadres.
-- current_org/current_rol/current_medewerker_id keken alleen naar de e-mailclaim in
-- de JWT. Staat in Supabase Auth ooit "Confirm email" uit (of komt er een
-- aanmeldroute bij), dan kon iemand zich aanmelden met het adres van een beheerder
-- en kreeg hij diens rechten. Nu telt een portaal_gebruikers-rij alleen als de
-- ingelogde gebruiker (auth.uid()) dat adres ook echt bevestigd heeft.
-- Rollback: de vorige versie zonder de exists(...)-regel (zie 0004_kms_schema.sql).
-- -----------------------------------------------------------------------------
create or replace function public.current_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pg.organisatie_id from public.portaal_gebruikers pg
  where lower(pg.email) = lower(auth.jwt() ->> 'email')
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid() and lower(u.email) = lower(pg.email) and u.email_confirmed_at is not null
    )
  limit 1
$$;

create or replace function public.current_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pg.rol from public.portaal_gebruikers pg
  where lower(pg.email) = lower(auth.jwt() ->> 'email')
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid() and lower(u.email) = lower(pg.email) and u.email_confirmed_at is not null
    )
  limit 1
$$;

create or replace function public.current_medewerker_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pg.medewerker_id from public.portaal_gebruikers pg
  where lower(pg.email) = lower(auth.jwt() ->> 'email')
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid() and lower(u.email) = lower(pg.email) and u.email_confirmed_at is not null
    )
  limit 1
$$;

-- -----------------------------------------------------------------------------
-- BLOK 2: drukproeven alleen voor beheerder/leidinggevende.
-- Getest: een portaalgebruiker met rol 'medewerker' kon via de REST-API een
-- drukproef van de eigen organisatie goedkeuren en de logo-url wijzigen
-- (drukproeven_upd, rol public, alleen org-check). Ook kon hij het token lezen en
-- daarmee via /drukproef/<token> goedkeuren. Het portaal toont drukproeven alleen
-- aan beheerder/leidinggevende, dus dit breekt niets.
-- Rollback: verwijder policy drukproeven_rol_sel / drukproeven_rol_upd on public.drukproeven;
-- -----------------------------------------------------------------------------
drop policy if exists drukproeven_rol_sel on public.drukproeven;
create policy drukproeven_rol_sel on public.drukproeven
  as restrictive for select to authenticated
  using (current_rol() = any (array['beheerder', 'leidinggevende']));

drop policy if exists drukproeven_rol_upd on public.drukproeven;
create policy drukproeven_rol_upd on public.drukproeven
  as restrictive for update to authenticated
  using (current_rol() = any (array['beheerder', 'leidinggevende']))
  with check (current_rol() = any (array['beheerder', 'leidinggevende']));

-- -----------------------------------------------------------------------------
-- BLOK 3: facturen en factuurregels alleen voor beheerder/leidinggevende.
-- Getest: een 'medewerker' las via de REST-API de 2 facturen van zijn werkgever.
-- Het portaal leest facturen via de service-role en alleen voor beheer-rollen.
-- Rollback: verwijder policy facturen_rol_sel on public.facturen;
--           verwijder policy factuurregels_rol_sel on public.factuurregels;
-- -----------------------------------------------------------------------------
drop policy if exists facturen_rol_sel on public.facturen;
create policy facturen_rol_sel on public.facturen
  as restrictive for select to authenticated
  using (current_rol() = any (array['beheerder', 'leidinggevende']));

drop policy if exists factuurregels_rol_sel on public.factuurregels;
create policy factuurregels_rol_sel on public.factuurregels
  as restrictive for select to authenticated
  using (current_rol() = any (array['beheerder', 'leidinggevende']));

-- -----------------------------------------------------------------------------
-- BLOK 4: interne CRM-gegevens niet via het portaal.
-- klant_activiteiten (notities van Frederiks over de klant) en contactpersonen
-- waren leesbaar voor iedere portaalgebruiker van die klant. Het portaal gebruikt
-- geen van beide. klant_activiteiten: nooit; contactpersonen: alleen beheer-rollen.
-- Rollback: verwijder policy klant_activiteiten_geen_portaal on public.klant_activiteiten;
--           verwijder policy contactpersonen_rol_sel on public.contactpersonen;
-- -----------------------------------------------------------------------------
drop policy if exists klant_activiteiten_geen_portaal on public.klant_activiteiten;
create policy klant_activiteiten_geen_portaal on public.klant_activiteiten
  as restrictive for select to authenticated
  using (false);

drop policy if exists contactpersonen_rol_sel on public.contactpersonen;
create policy contactpersonen_rol_sel on public.contactpersonen
  as restrictive for select to authenticated
  using (current_rol() = any (array['beheerder', 'leidinggevende']));

-- -----------------------------------------------------------------------------
-- BLOK 5: privacy binnen een klant (AVG, dataminimalisatie).
-- Een 'medewerker' kon van al zijn collega's het huisadres, telefoon, e-mail en
-- opmerkingen lezen (medewerkers_select, alleen org-check), en de e-mailadressen en
-- rollen van alle portaalgebruikers. Nu: beheerder/leidinggevende zien iedereen van
-- de eigen organisatie, een medewerker alleen zichzelf.
-- Gecontroleerd in de code: alle portaalpagina's die collega's tonen (team,
-- medewerkers, goedkeuringen) zijn al alleen voor beheer-rollen; de webshop laat
-- alleen een gebruiker ZONDER eigen medewerker-koppeling een collega kiezen.
-- Rollback: verwijder policy medewerkers_rol_sel on public.medewerkers;
--           verwijder policy portaal_gebruikers_rol_sel on public.portaal_gebruikers;
-- -----------------------------------------------------------------------------
drop policy if exists medewerkers_rol_sel on public.medewerkers;
create policy medewerkers_rol_sel on public.medewerkers
  as restrictive for select to authenticated
  using (
    current_rol() = any (array['beheerder', 'leidinggevende'])
    or id = current_medewerker_id()
    or current_medewerker_id() is null
  );

drop policy if exists portaal_gebruikers_rol_sel on public.portaal_gebruikers;
create policy portaal_gebruikers_rol_sel on public.portaal_gebruikers
  as restrictive for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or current_rol() = any (array['beheerder', 'leidinggevende'])
  );

-- Controle (alleen lezen):
--   select tablename, policyname, permissive, roles, cmd, qual
--   from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE';
