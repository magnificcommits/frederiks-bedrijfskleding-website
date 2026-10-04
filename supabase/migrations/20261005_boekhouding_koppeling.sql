-- Koppeling met de boekhouding (Moneybird) en logboek per poging (5 okt 2026).
-- Alleen toevoegen, idempotent. Instellingen (standaard grootboek, automatisch
-- doorzetten, wat Moneybird na het aanmaken doet) staan in de bestaande
-- sleutel/waarde-tabel `instellingen`; daarvoor is geen migratie nodig.
--
-- Foreign keys: boekhouding_sync_log verwijst één keer naar facturen. Er komt
-- geen tweede verwijzing tussen bestaande tabellen bij, dus bestaande
-- PostgREST-embeds blijven ondubbelzinnig.

-- Klant -> Moneybird-contact.
alter table public.organisaties add column if not exists moneybird_contact_id text;

-- Factuur -> Moneybird-verkoopfactuur.
alter table public.facturen add column if not exists moneybird_factuur_id text;
-- State zoals Moneybird hem geeft: draft, open, scheduled, pending_payment, late, reminded, paid, uncollectible.
alter table public.facturen add column if not exists moneybird_status text;
-- Laatste keer dat er met Moneybird is gepraat over deze factuur (doorzetten of status ophalen).
alter table public.facturen add column if not exists moneybird_gesynct_op timestamptz;
-- Totaal incl. btw volgens Moneybird, om verschillen met het KMS te zien.
alter table public.facturen add column if not exists moneybird_totaal numeric;
-- Laatste foutmelding in gewone taal (leeg als het goed ging).
alter table public.facturen add column if not exists boekhouding_fout text;
-- null = nog niet doorgezet, 'bezig' = wordt nu doorgezet, 'doorgezet', 'fout'.
alter table public.facturen add column if not exists boekhouding_status text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'facturen_boekhouding_status_chk') then
    alter table public.facturen add constraint facturen_boekhouding_status_chk
      check (boekhouding_status is null or boekhouding_status in ('bezig', 'doorgezet', 'fout'));
  end if;
end $$;
create index if not exists facturen_boekhouding_status on public.facturen (boekhouding_status);
create index if not exists facturen_moneybird_open on public.facturen (moneybird_gesynct_op)
  where moneybird_factuur_id is not null and status <> 'betaald';

-- Logboek: elke poging om iets met de boekhouding te doen, gelukt of niet.
create table if not exists public.boekhouding_sync_log (
  id uuid primary key default gen_random_uuid(),
  factuur_id uuid references public.facturen(id) on delete cascade,
  -- Geen foreign key naar organisaties: alleen ter herkenning bij contactsynchronisatie.
  organisatie_id uuid,
  pakket text not null default 'moneybird',
  -- 'contact', 'factuur', 'versturen', 'status', 'test'
  actie text not null,
  gelukt boolean not null,
  melding text,
  details jsonb,
  actor text,
  created_at timestamptz not null default now()
);
create index if not exists boekhouding_sync_log_factuur on public.boekhouding_sync_log (factuur_id, created_at desc);
create index if not exists boekhouding_sync_log_created on public.boekhouding_sync_log (created_at desc);
-- RLS aan zonder policies: alleen de service-role (kmsAdmin) leest en schrijft.
alter table public.boekhouding_sync_log enable row level security;
