-- Taken v2 (feedback Tim, 3 okt 2026): eigen statussen, vaste personen, herinneringen,
-- prullenbak, archief, herhalende taken, afspraken met eindtijd en locatie, e-mailoverzichten
-- en een agenda-abonnement per persoon.
--
-- Alleen toevoegingen. Idempotent: mag vaker gedraaid worden.
-- Nieuwe tabellen: RLS aan, GEEN policies (alles loopt via de service-role in het dashboard).
-- taken.werkstatus (tekst) blijft de waarheid; taak_statussen beschrijft alleen naam/kleur/volgorde.
-- Het pg_cron-blok onderaan staat in commentaar en wordt apart gedraaid.

-- ---------------------------------------------------------------------------
-- 1. Personen
-- ---------------------------------------------------------------------------
create table if not exists public.taak_personen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  email text,
  kleur text default 'blauw',
  actief boolean not null default true,
  dagoverzicht boolean not null default true,
  weekoverzicht boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.taak_personen
  add column if not exists admin_email text,
  -- Taken zonder persoon (bijvoorbeeld automatische ordertaken) ook in de overzichtsmail van deze persoon.
  add column if not exists ook_zonder_persoon boolean not null default false,
  -- Geheime sleutel voor de agenda-feed (/api/agenda/<token>). 64 tekens, willekeurig.
  add column if not exists agenda_token text not null
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table public.taak_personen enable row level security;

create unique index if not exists taak_personen_naam_uniek on public.taak_personen (lower(naam));
create unique index if not exists taak_personen_agenda_token_uniek on public.taak_personen (agenda_token);
create unique index if not exists taak_personen_admin_email_uniek
  on public.taak_personen (lower(admin_email)) where admin_email is not null;

-- Seed: Jessi (zonder e-mail; die vult ze zelf in bij Instellingen) krijgt ook de taken zonder persoon.
insert into public.taak_personen (naam, email, kleur, ook_zonder_persoon)
select 'Jessi', null, 'oranje', true
where not exists (select 1 from public.taak_personen where lower(naam) = 'jessi');

-- Actieve beheerders: bestaat er al een persoon met dezelfde naam, dan koppelen we die.
update public.taak_personen p
   set admin_email = a.email,
       email = coalesce(p.email, a.email)
  from public.admin_gebruikers a
 where a.actief
   and p.admin_email is null
   and lower(p.naam) = lower(coalesce(nullif(trim(a.naam), ''), split_part(a.email, '@', 1)))
   and not exists (select 1 from public.taak_personen q where lower(q.admin_email) = lower(a.email));

insert into public.taak_personen (naam, email, admin_email, kleur)
select distinct on (lower(coalesce(nullif(trim(a.naam), ''), split_part(a.email, '@', 1))))
       coalesce(nullif(trim(a.naam), ''), split_part(a.email, '@', 1)),
       a.email,
       a.email,
       'blauw'
  from public.admin_gebruikers a
 where a.actief
   and not exists (select 1 from public.taak_personen p where lower(p.admin_email) = lower(a.email))
   and not exists (
     select 1 from public.taak_personen p
      where lower(p.naam) = lower(coalesce(nullif(trim(a.naam), ''), split_part(a.email, '@', 1)))
   )
 order by lower(coalesce(nullif(trim(a.naam), ''), split_part(a.email, '@', 1))), a.created_at;

-- ---------------------------------------------------------------------------
-- 2. Nieuwe kolommen op taken
-- ---------------------------------------------------------------------------
alter table public.taken
  add column if not exists persoon_id uuid references public.taak_personen(id) on delete set null,
  add column if not exists eind_tijd time,
  add column if not exists locatie text,
  add column if not exists herinnering_op timestamptz,
  -- Minuten vóór het begin (0 = op het tijdstip). Null bij een zelf gekozen tijdstip.
  -- Zo schuift de herinnering mee als de datum of tijd verandert.
  add column if not exists herinnering_minuten int,
  add column if not exists herinnering_verstuurd_op timestamptz,
  add column if not exists herhaling text not null default 'geen',
  add column if not exists verwijderd_op timestamptz,
  add column if not exists gearchiveerd_op timestamptz;
do $$ begin
  alter table public.taken add constraint taken_herhaling_chk
    check (herhaling in ('geen', 'dagelijks', 'wekelijks', 'maandelijks'));
exception when duplicate_object then null; end $$;

create index if not exists idx_taken_verwijderd_op on public.taken (verwijderd_op);
create index if not exists idx_taken_gearchiveerd_op on public.taken (gearchiveerd_op);
create index if not exists idx_taken_persoon on public.taken (persoon_id);
create index if not exists idx_taken_herinnering on public.taken (herinnering_op)
  where herinnering_verstuurd_op is null;

-- Vrij getypte namen (toegewezen_aan) omzetten naar personen: per unieke naam één persoon.
insert into public.taak_personen (naam, kleur)
select distinct on (lower(trim(t.toegewezen_aan))) trim(t.toegewezen_aan), 'grijs'
  from public.taken t
 where nullif(trim(t.toegewezen_aan), '') is not null
   and not exists (select 1 from public.taak_personen p where lower(p.naam) = lower(trim(t.toegewezen_aan)))
 order by lower(trim(t.toegewezen_aan)), t.created_at;

update public.taken t
   set persoon_id = p.id
  from public.taak_personen p
 where t.persoon_id is null
   and nullif(trim(t.toegewezen_aan), '') is not null
   and lower(p.naam) = lower(trim(t.toegewezen_aan));

-- ---------------------------------------------------------------------------
-- 3. Statussen
-- ---------------------------------------------------------------------------
create table if not exists public.taak_statussen (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  kleur text not null default 'grijs',
  groep text not null default 'bezig',
  volgorde int not null default 0,
  actief boolean not null default true,
  is_afgerond boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.taak_statussen
  -- Vaste sleutel voor de 24 standaardstappen; de automatische taken zoeken hun stap hierop,
  -- zodat Jessi de naam vrij kan wijzigen. Null bij zelf aangemaakte statussen.
  add column if not exists sleutel text,
  -- Eerdere namen (na hernoemen). Code die nog een oude naam schrijft, wordt daarmee rechtgezet.
  add column if not exists oude_namen text[] not null default '{}';
do $$ begin
  alter table public.taak_statussen add constraint taak_statussen_groep_chk
    check (groep in ('open', 'bezig', 'wacht', 'klaar'));
exception when duplicate_object then null; end $$;
create unique index if not exists taak_statussen_sleutel_uniek on public.taak_statussen (sleutel) where sleutel is not null;
alter table public.taak_statussen enable row level security;

insert into public.taak_statussen (naam, sleutel, kleur, groep, volgorde, is_afgerond) values
  ('Niet gestart',                 'niet_gestart',                 'grijs',  'open',  1,  false),
  ('Benaderen',                    'benaderen',                    'geel',   'bezig', 2,  false),
  ('Afspraak maken',               'afspraak_maken',               'geel',   'bezig', 3,  false),
  ('Afspraak staat',               'afspraak_staat',               'paars',  'wacht', 4,  false),
  ('Pasafspraak plannen',          'pasafspraak_plannen',          'geel',   'bezig', 5,  false),
  ('Passerie bestellen',           'passerie_bestellen',           'oranje', 'bezig', 6,  false),
  ('Passerie afleveren',           'passerie_afleveren',           'geel',   'bezig', 7,  false),
  ('Passerie bij klant',           'passerie_bij_klant',           'paars',  'wacht', 8,  false),
  ('Offerte sturen',               'offerte_sturen',               'oranje', 'bezig', 9,  false),
  ('Offerte gestuurd',             'offerte_gestuurd',             'paars',  'wacht', 10, false),
  ('Nog bestellen',                'nog_bestellen',                'oranje', 'bezig', 11, false),
  ('Al besteld nog niet geleverd', 'al_besteld_nog_niet_geleverd', 'bruin',  'wacht', 12, false),
  ('Logo''s bestellen',            'logos_bestellen',              'oranje', 'bezig', 13, false),
  ('Logo''s ophalen',              'logos_ophalen',                'geel',   'bezig', 14, false),
  ('Logo''s printen',              'logos_printen',                'geel',   'bezig', 15, false),
  ('Coupeuse',                     'coupeuse',                     'roze',   'wacht', 16, false),
  ('Opsturen naar borduurder',     'opsturen_naar_borduurder',     'oranje', 'bezig', 17, false),
  ('Bij borduurder',               'bij_borduurder',               'roze',   'wacht', 18, false),
  ('Nog bedrukken',                'nog_bedrukken',                'geel',   'bezig', 19, false),
  ('In uitvoering',                'in_uitvoering',                'geel',   'bezig', 20, false),
  ('Afleveren',                    'afleveren',                    'geel',   'bezig', 21, false),
  ('Naar herenzaak',               'naar_herenzaak',               'roze',   'wacht', 22, false),
  ('Factuur sturen',               'factuur_sturen',               'blauw',  'bezig', 23, false),
  ('Afgerond',                     'afgerond',                     'groen',  'klaar', 24, true)
on conflict (naam) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Meldingenlog (voorkomt dubbel mailen)
-- ---------------------------------------------------------------------------
create table if not exists public.taak_meldingen_log (
  id uuid primary key default gen_random_uuid(),
  persoon_id uuid references public.taak_personen(id) on delete cascade,
  soort text not null,
  taak_id uuid references public.taken(id) on delete set null,
  datum date not null default ((now() at time zone 'Europe/Amsterdam')::date),
  aantal int,
  verstuurd_op timestamptz not null default now()
);
do $$ begin
  alter table public.taak_meldingen_log add constraint taak_meldingen_log_soort_chk
    check (soort in ('dag', 'week', 'herinnering'));
exception when duplicate_object then null; end $$;
create unique index if not exists taak_meldingen_log_uniek
  on public.taak_meldingen_log (persoon_id, soort, datum) where soort in ('dag', 'week');
create index if not exists idx_taak_meldingen_log_datum on public.taak_meldingen_log (verstuurd_op);
alter table public.taak_meldingen_log enable row level security;


-- ===========================================================================
-- APART BLOK: PG_CRON + PG_NET (NIET AUTOMATISCH DRAAIEN)
-- ===========================================================================
-- Vercel Hobby staat maar twee crons per dag toe, dus de meldingen (herinneringen,
-- dagoverzicht 07:00, weekoverzicht maandag 07:00, prullenbak en archief opruimen)
-- worden elke 10 minuten door Supabase zelf aangeroepen.
--
-- Stappen voor de orchestrator / Tim:
--   a. Kies een lange willekeurige waarde (bijv. `openssl rand -hex 32`).
--   b. Zet die op Vercel als env TAKEN_CRON_SECRET (Production) en redeploy.
--   c. Zet dezelfde waarde in Supabase Vault (stap 2 hieronder; vervang <GEHEIM>).
--      Het geheim staat daarna versleuteld in de database en NIET in deze job-definitie.
--   d. Vervang <SITE> door het echte domein (bijv. www.frederiksbedrijfskleding.nl).
--   e. Draai stap 1 t/m 3 in de Supabase SQL Editor.
--   f. Test: `select * from cron.job_run_details order by start_time desc limit 5;`
--      en `select * from net._http_response order by created desc limit 5;`
--      (status 200 en een JSON-antwoord met "ok": true).
--
-- -- 1. Extensies (op Supabase al beschikbaar, alleen aanzetten)
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- -- 2. Geheim in de Vault (eenmalig; bij wijzigen: vault.update_secret)
-- select vault.create_secret('<GEHEIM>', 'taken_cron_secret', 'Header x-taken-secret voor /api/cron/taken');
--
-- -- 3. Job: elke 10 minuten een POST naar het endpoint
-- select cron.unschedule('taken-meldingen') where exists (select 1 from cron.job where jobname = 'taken-meldingen');
-- select cron.schedule(
--   'taken-meldingen',
--   '*/10 * * * *',
--   $job$
--   select net.http_post(
--     url := 'https://<SITE>/api/cron/taken',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-taken-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'taken_cron_secret' limit 1)
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 55000
--   );
--   $job$
-- );
--
-- -- Stoppen: select cron.unschedule('taken-meldingen');
-- ===========================================================================
