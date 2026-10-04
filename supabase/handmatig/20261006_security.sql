-- =============================================================================
-- Security-audit oktober 2026: HANDMATIG uit te voeren (Tim).
--
-- Deze blokken nemen rechten weg of verwijderen een policy. Daarom zijn ze NIET
-- automatisch toegepast. Voer ze één voor één uit in de Supabase SQL-editor
-- (project ldbyljadqququzoicyid), lees eerst de uitleg en draai daarna de
-- controlequery. Elk blok staat op zichzelf; volgorde maakt niet uit.
-- Achtergrond en testbewijs: docs/security-audit-2026-10.md.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOK A (middel): bestandenlijst van de bucket 'media' niet meer openbaar.
--
-- Probleem: de policy media_public_read (rol public, SELECT op storage.objects)
-- laat IEDEREEN met de publieke anon-key de volledige bestandslijst opvragen
-- (POST /storage/v1/object/list/media). Daarmee zijn alle logo's, drukproeven en
-- reparatiefoto's van alle klanten te vinden, ook zonder de link te kennen.
--
-- Waarom veilig: de bucket is "public". Downloaden via de publieke URL
-- (/storage/v1/object/public/media/...) heeft GEEN policy nodig en blijft werken.
-- Uploaden gebeurt alleen server-side met de service-role. De code gebruikt
-- nergens .list() (gecontroleerd met grep).
-- Terugdraaien: create policy media_public_read on storage.objects for select
--               to public using (bucket_id = 'media');
-- -----------------------------------------------------------------------------
drop policy if exists media_public_read on storage.objects;

-- Controle: moet 0 rijen geven.
-- select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects';


-- -----------------------------------------------------------------------------
-- BLOK B (laag): grenzen op de bucket 'media'.
--
-- Nu: geen maximale bestandsgrootte en elk bestandstype. De code beperkt het al
-- (lib/kms/storage.ts: max 25 MB, geen html/js/exe, content-type alleen voor
-- afbeeldingen/PDF), maar de bucket zelf is de laatste verdedigingslinie.
-- LET OP: borduurbestanden (.dst, .emb, .pes) en vectorbestanden (.ai, .eps)
-- hebben vaak het type application/octet-stream of application/postscript. Die
-- staan in de lijst. Komt er een upload-melding "type niet toegestaan", voeg het
-- type dan hier toe.
-- Terugdraaien: update storage.buckets set file_size_limit = null,
--               allowed_mime_types = null where id = 'media';
-- -----------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
      'image/heic', 'image/heif', 'image/tiff', 'image/svg+xml',
      'application/pdf', 'application/postscript', 'application/octet-stream'
    ]
where id = 'media';


-- -----------------------------------------------------------------------------
-- BLOK C (middel): interne notities niet leesbaar voor klanten.
--
-- Probleem: iedere portaalgebruiker (ook rol 'medewerker') kan via de REST-API
-- met zijn eigen sessie de hele rij van zijn organisatie lezen, inclusief
--   organisaties.interne_notities, organisaties.opmerkingen,
--   organisaties.moneybird_contact_id
-- en bij zijn orders ook orders.interne_notitie. Dat zijn notities van Frederiks.
-- RLS werkt per rij, niet per kolom: daarvoor zijn kolomrechten nodig.
--
-- Waarom veilig: het portaal selecteert op deze tabellen alleen expliciete kolommen
-- (gecontroleerd: lib/portaal/queries.ts, huisstijl.ts, webshop.ts, orders.ts,
-- goedkeuringen.ts, service.ts; geen select('*')). Het KMS gebruikt de service-role
-- en heeft geen last van kolomrechten.
-- Na uitvoeren testen: portaal openen als beheerder (home, webshop, bestellingen,
-- goedkeuringen, retouren). Een fout "permission denied for table" betekent dat
-- ergens toch een niet-toegestane kolom wordt gelezen: dan die kolom hieronder
-- toevoegen.
-- Terugdraaien: grant select on public.organisaties, public.orders to authenticated;
-- -----------------------------------------------------------------------------
revoke select on public.organisaties from authenticated;
grant select (
  id, naam, plaats, created_at, telefoon, adres, postcode, klantnummer, bezoekadres, postadres, land,
  kvk, btw_nummer, contactpersoon, functie_contactpersoon, mobiel, email_algemeen, factuur_email,
  website, actief, datum_klant, accountmanager, budget_actief, goedkeuren_bestellingen, levering,
  facturatie_wijze, type, min_bestelbedrag, max_bestelbedrag, toon_kortingen, gebruik_referentienr,
  opmerking_bij_bestelling, toon_voorraad, voorwaarden_tekst, voorschriften_tekst, verzendkosten,
  bestelperiode_start, bestelperiode_eind, huisstijl_kleur, portaal_logo_url, sfeerafbeelding_url,
  korting_pct, retouren_actief, branche
) on public.organisaties to authenticated;

revoke select on public.orders from authenticated;
grant select (
  id, ordernummer, organisatie_id, medewerker_id, afdeling_id, besteldatum, status, goedkeuring_status,
  goedgekeurd_door, bedrag, aangevraagd_door, notitie, created_at, vestiging_id, referentienr,
  track_trace_code, vervoerder, aangevraagd_door_contact_id, aangevraagd_door_medewerker_id,
  goedgekeurd_door_contact_id, goedgekeurd_door_medewerker_id, geleverd_op, offerte_id
) on public.orders to authenticated;

-- Controle: moet false/false geven.
-- select has_column_privilege('authenticated', 'public.organisaties', 'interne_notities', 'select'),
--        has_column_privilege('authenticated', 'public.orders', 'interne_notitie', 'select');


-- -----------------------------------------------------------------------------
-- BLOK D (laag): policies op rol 'public' naar 'authenticated'.
--
-- Deze policies gelden nu voor rol public (dus ook anon). Ze zijn veilig omdat
-- current_org() voor anon niets oplevert (getest: anon ziet 0 rijen), maar
-- "to authenticated" is de bedoeling en voorkomt verrassingen als iemand later een
-- policy met "or true" toevoegt.
-- Terugdraaien: dezelfde statements met "to public".
-- -----------------------------------------------------------------------------
alter policy drukproeven_sel on public.drukproeven to authenticated;
alter policy drukproeven_upd on public.drukproeven to authenticated;
alter policy kledinglijn_eigen on public.kledinglijn_items to authenticated;
alter policy maten_select on public.maten to authenticated;
alter policy verzoeken_ins on public.medewerker_verzoeken to authenticated;
alter policy verzoeken_sel on public.medewerker_verzoeken to authenticated;
alter policy medewerkers_select on public.medewerkers to authenticated;
alter policy org_eigen on public.organisaties to authenticated;
alter policy bestellingen_insert on public.portaal_bestellingen to authenticated;
alter policy bestelregels_insert on public.portaal_bestelregels to authenticated;
alter policy gebruiker_eigen_rij on public.portaal_gebruikers to authenticated;
alter policy meldingen_sel on public.portaal_meldingen to authenticated;

-- Controle: moet 0 rijen geven.
-- select tablename, policyname from pg_policies
-- where schemaname = 'public' and 'public' = any (roles);


-- -----------------------------------------------------------------------------
-- BLOK E (laag): functies die anon niet hoeft aan te roepen.
--
-- volgend_retournummer() (security invoker) verhoogt een teller; anon kan hem nu
-- via /rest/v1/rpc aanroepen en zo retournummers "opmaken". decoratie_stukprijs()
-- leest tarieven (geeft voor anon niets terug door RLS, maar hoort niet publiek).
-- De code roept beide alleen aan met de service-role.
-- Terugdraaien: grant execute on function ... to anon, authenticated;
-- -----------------------------------------------------------------------------
revoke execute on function public.volgend_retournummer() from public, anon, authenticated;
revoke execute on function public.decoratie_stukprijs(text, text, integer) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- BLOK F (performance, optioneel): advisor auth_rls_initplan.
-- auth.jwt() per rij laten evalueren is traag op grote tabellen. portaal_gebruikers
-- is klein, dus geen haast. (select auth.jwt()) wordt één keer per query berekend.
-- -----------------------------------------------------------------------------
alter policy portaal_gebruikers_rol_sel on public.portaal_gebruikers
  using (lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
         or current_rol() = any (array['beheerder', 'leidinggevende']));
alter policy gebruiker_eigen_rij on public.portaal_gebruikers
  using (lower(email) = lower((select auth.jwt()) ->> 'email'));


-- =============================================================================
-- NIET IN SQL: instellingen in het Supabase-dashboard (Authentication).
--  1. Authentication > Providers > Email: "Confirm email" AAN laten.
--     (De database eist sinds 20261006_security_rls_aanscherping zelf ook een
--     bevestigd adres, dit is de tweede laag.)
--  2. Authentication > Sign In / Providers: "Allow new users to sign up" UIT als
--     portaalgebruikers altijd door Frederiks worden aangemaakt. Controleer dan wel
--     dat de inloglink/OTP voor bestaande gebruikers blijft werken.
--  3. Authentication > Rate Limits: "Token verifications" op max 30 per 5 min per IP
--     laten staan (standaard). Dit is de echte bescherming tegen het raden van de
--     6-cijferige portaalcode: het portaal controleert de code in de browser
--     rechtstreeks bij Supabase, de app-limiter ziet die pogingen niet.
--  4. Authentication > Email: OTP-verlooptijd naar 600 seconden (nu standaard 3600).
--  5. Authentication > Password security: "Leaked password protection" AAN
--     (advisor auth_leaked_password_protection).
--  6. MFA (TOTP) verplicht maken voor alle KMS-eigenaren (admin_gebruikers).
-- =============================================================================
