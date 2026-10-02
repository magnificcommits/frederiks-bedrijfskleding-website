-- =============================================================================
-- Stream F: beveiliging (2 oktober 2026)
-- Additief en idempotent: kan veilig meerdere keren worden uitgevoerd.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOK 1: mislukte inlogpogingen (rate limiting dashboard-login)
-- De code (lib/ratelimit.ts) telt hier mislukte pogingen per IP / e-mailadres.
-- Sleutels worden gehasht opgeslagen (sha256), er staan dus geen IP- of
-- e-mailadressen leesbaar in. Bestaat de tabel nog niet, dan valt de code terug
-- op een teller in het geheugen.
-- Alleen de service-role client schrijft/leest: RLS aan, geen policies.
-- -----------------------------------------------------------------------------
create table if not exists public.login_pogingen (
  id uuid primary key default gen_random_uuid(),
  sleutel text not null,
  created_at timestamptz not null default now()
);

create index if not exists login_pogingen_sleutel_tijd_idx
  on public.login_pogingen (sleutel, created_at desc);
create index if not exists login_pogingen_tijd_idx
  on public.login_pogingen (created_at);

alter table public.login_pogingen enable row level security;
revoke all on table public.login_pogingen from anon, authenticated;


-- -----------------------------------------------------------------------------
-- BLOK 2: RLS-gaten dichten op medewerkers en maten
--
-- Probleem: policies worden ge-OR-d. Naast de juiste policies voor rol
-- authenticated met rolcheck (medewerkers_ins / _upd / _del: alleen beheerder of
-- leidinggevende van de eigen organisatie) bestonden er oude policies voor rol
-- PUBLIC met alleen een organisatiecheck. Daardoor kon iedere ingelogde
-- portaalgebruiker (ook rol 'medewerker') collega's toevoegen, wijzigen en
-- verwijderen, en andermans maten aanpassen.
--
-- Onderzocht (lib/portaal + app/portaal), schrijfacties met de gebruikerssessie:
--   medewerkers insert : lib/portaal/team.ts maakMedewerkerMetToegang  (guard: beheerder)
--   medewerkers update : lib/portaal/team.ts zetBudget, zetBudgetInstellingen,
--                        zetVestiging; lib/portaal/queries.ts zetBudget
--                        (guards: beheerder / beheerder of leidinggevende)
--   medewerkers delete : lib/portaal/queries.ts verwijderMedewerker (niet meer
--                        aangeroepen: verwijderen gaat via een verzoek aan Jessi)
--   maten upsert       : lib/portaal/queries.ts zetMaat (guard: beheerder of leidinggevende)
-- Een gewone medewerker hoeft dus nergens rijen in medewerkers te schrijven.
-- Alle dashboardacties gebruiken de service-role client en omzeilen RLS.
--
-- Besluit:
--   * medewerkers_insert / _update / _delete (public, alleen org-check) vervallen.
--     De bestaande authenticated-policies met rolcheck dekken alle legitieme acties.
--   * medewerkers_select blijft BEWUST staan: de webshop laat een gebruiker zonder
--     eigen medewerker-match uit de collega's van de eigen organisatie kiezen
--     (getWebshopMedewerkers). Lezen binnen de eigen organisatie is geen gat.
--   * maten_insert / _update / _delete (public, alleen org-check) vervallen en worden
--     vervangen door policies voor authenticated: beheerder/leidinggevende van de
--     organisatie van die medewerker, of de medewerker zelf voor zijn eigen maten
--     (insert/update). Verwijderen alleen beheerder/leidinggevende.
--     De organisatiecheck loopt via medewerkers, zodat hij werkt ongeacht of
--     maten een eigen organisatie_id-kolom heeft.
-- -----------------------------------------------------------------------------

-- Veiligheidsnet: alleen de te ruime public-policies op medewerkers droppen als de
-- juiste authenticated-policy voor dezelfde actie bestaat. Ontbreekt die, dan maken
-- we hem eerst aan (zelfde rolcheck als in de bestaande opzet), zodat beheerders in
-- het portaal nooit buitengesloten worden.
do $$
begin
  if to_regclass('public.medewerkers') is null then
    return;
  end if;

  -- insert
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'medewerkers' and cmd in ('INSERT', 'ALL')
      and policyname <> 'medewerkers_insert'
      and 'authenticated' = any (roles)
  ) then
    execute 'drop policy if exists medewerkers_ins_veilig on public.medewerkers';
    execute $p$create policy medewerkers_ins_veilig on public.medewerkers for insert to authenticated
      with check (organisatie_id = current_org() and current_rol() = any (array['beheerder','leidinggevende']))$p$;
  end if;
  execute 'drop policy if exists medewerkers_insert on public.medewerkers';

  -- update
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'medewerkers' and cmd in ('UPDATE', 'ALL')
      and policyname <> 'medewerkers_update'
      and 'authenticated' = any (roles)
  ) then
    execute 'drop policy if exists medewerkers_upd_veilig on public.medewerkers';
    execute $p$create policy medewerkers_upd_veilig on public.medewerkers for update to authenticated
      using (organisatie_id = current_org() and current_rol() = any (array['beheerder','leidinggevende']))
      with check (organisatie_id = current_org() and current_rol() = any (array['beheerder','leidinggevende']))$p$;
  end if;
  execute 'drop policy if exists medewerkers_update on public.medewerkers';

  -- delete
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'medewerkers' and cmd in ('DELETE', 'ALL')
      and policyname <> 'medewerkers_delete'
      and 'authenticated' = any (roles)
  ) then
    execute 'drop policy if exists medewerkers_del_veilig on public.medewerkers';
    execute $p$create policy medewerkers_del_veilig on public.medewerkers for delete to authenticated
      using (organisatie_id = current_org() and current_rol() = any (array['beheerder','leidinggevende']))$p$;
  end if;
  execute 'drop policy if exists medewerkers_delete on public.medewerkers';
end
$$;

-- maten: te ruime policies vervangen door rolcheck / eigen-rij-check.
do $$
begin
  if to_regclass('public.maten') is null then
    return;
  end if;

  execute 'drop policy if exists maten_insert on public.maten';
  execute 'drop policy if exists maten_update on public.maten';
  execute 'drop policy if exists maten_delete on public.maten';

  execute 'drop policy if exists maten_ins_veilig on public.maten';
  execute $p$create policy maten_ins_veilig on public.maten for insert to authenticated
    with check (
      exists (
        select 1 from public.medewerkers m
        where m.id = maten.medewerker_id and m.organisatie_id = current_org()
      )
      and (
        current_rol() = any (array['beheerder','leidinggevende'])
        or maten.medewerker_id = current_medewerker_id()
      )
    )$p$;

  execute 'drop policy if exists maten_upd_veilig on public.maten';
  execute $p$create policy maten_upd_veilig on public.maten for update to authenticated
    using (
      exists (
        select 1 from public.medewerkers m
        where m.id = maten.medewerker_id and m.organisatie_id = current_org()
      )
      and (
        current_rol() = any (array['beheerder','leidinggevende'])
        or maten.medewerker_id = current_medewerker_id()
      )
    )
    with check (
      exists (
        select 1 from public.medewerkers m
        where m.id = maten.medewerker_id and m.organisatie_id = current_org()
      )
      and (
        current_rol() = any (array['beheerder','leidinggevende'])
        or maten.medewerker_id = current_medewerker_id()
      )
    )$p$;

  execute 'drop policy if exists maten_del_veilig on public.maten';
  execute $p$create policy maten_del_veilig on public.maten for delete to authenticated
    using (
      exists (
        select 1 from public.medewerkers m
        where m.id = maten.medewerker_id and m.organisatie_id = current_org()
      )
      and current_rol() = any (array['beheerder','leidinggevende'])
    )$p$;
end
$$;

-- Controle achteraf (handmatig, alleen lezen):
--   select tablename, policyname, roles, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' and tablename in ('medewerkers','maten','medewerker_maten')
--   order by tablename, cmd, policyname;
-- Let op: medewerker_maten (voorkeursmaten) is in deze migratie NIET aangepast;
-- controleer met bovenstaande query of daar ook public-policies met alleen een
-- org-check staan (schrijven gebeurt in het portaal alleen door een beheerder).
