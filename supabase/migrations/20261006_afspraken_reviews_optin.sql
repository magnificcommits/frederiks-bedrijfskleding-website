-- Online afspraken, reviews/NPS uit echte klanten en double opt-in voor de nieuwsbrief.
-- Alleen toevoegen, idempotent. Geen drop/delete. RLS aan zonder policies: alles loopt
-- via de service-role (kmsAdmin) aan de serverkant.
--
-- Foreign keys: per tabelpaar maximaal één FK (anders PGRST201 bij embedden).
--   afspraken -> leads, taken, taak_personen
--   reviews   -> orders, organisaties, klachten, taken

-- ---------------------------------------------------------------------------
-- 1. Afspraken (adviesgesprek, showroombezoek, pasdag op locatie)
-- ---------------------------------------------------------------------------
create table if not exists public.afspraken (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 'advies' (bel/video), 'showroom' (Hengelo), 'pasdag' (bij de klant)
  soort text not null,
  start_op timestamptz not null,
  eind_op timestamptz not null,
  -- 'gepland', 'geweest', 'no_show', 'geannuleerd'
  status text not null default 'gepland',
  status_gewijzigd_op timestamptz,
  naam text not null,
  bedrijf text,
  email text not null,
  telefoon text,
  aantal_medewerkers text,
  branche text,
  opmerking text,
  -- Adres bij een pasdag, of "Telefonisch"/"Videogesprek" bij een adviesgesprek.
  locatie text,
  -- Pagina waar geboekt is plus herkomst (utm/referrer).
  bron text,
  -- Geheime sleutel voor de annuleer-/verzetlink in de bevestigingsmail.
  token text not null,
  -- Oplopend bij elke wijziging; SEQUENCE in de .ics zodat agenda's de update oppakken.
  ics_volgnummer integer not null default 0,
  lead_id uuid references public.leads(id) on delete set null,
  taak_id uuid references public.taken(id) on delete set null,
  persoon_id uuid references public.taak_personen(id) on delete set null,
  herinnering_verstuurd_op timestamptz,
  geannuleerd_op timestamptz,
  geannuleerd_door text,
  constraint afspraken_soort_chk check (soort in ('advies', 'showroom', 'pasdag')),
  constraint afspraken_status_chk check (status in ('gepland', 'geweest', 'no_show', 'geannuleerd')),
  constraint afspraken_tijd_chk check (eind_op > start_op)
);

create unique index if not exists afspraken_token_idx on public.afspraken (token);
create index if not exists afspraken_start_idx on public.afspraken (start_op);
create index if not exists afspraken_status_idx on public.afspraken (status);

-- Geen dubbele boekingen: twee geplande afspraken mogen elkaar niet overlappen.
-- De buffer tussen afspraken bewaakt de code; dit is het vangnet bij gelijktijdig boeken.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'afspraken_geen_overlap') then
    alter table public.afspraken
      add constraint afspraken_geen_overlap
      exclude using gist (tstzrange(start_op, eind_op, '[)') with &&)
      where (status = 'gepland');
  end if;
end $$;

alter table public.afspraken enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Reviews en NPS
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 0 t/m 10; leeg zolang de klant nog niet heeft geklikt.
  score smallint,
  tekst text,
  naam text,
  bedrijf text,
  branche text,
  toestemming_publiceren boolean not null default false,
  gepubliceerd boolean not null default false,
  gepubliceerd_op timestamptz,
  uitgelicht boolean not null default false,
  order_id uuid references public.orders(id) on delete set null,
  klant_id uuid references public.organisaties(id) on delete set null,
  email text,
  token text,
  -- 'nps-mail' (automatisch na levering) of 'handmatig'.
  bron text not null default 'nps-mail',
  verstuurd_op timestamptz,
  beantwoord_op timestamptz,
  klacht_id uuid references public.klachten(id) on delete set null,
  taak_id uuid references public.taken(id) on delete set null,
  constraint reviews_score_chk check (score is null or (score between 0 and 10)),
  constraint reviews_publiceren_chk check (not gepubliceerd or toestemming_publiceren)
);

create unique index if not exists reviews_token_idx on public.reviews (token);
-- Eén beoordelingsverzoek per order.
create unique index if not exists reviews_order_idx on public.reviews (order_id);
create index if not exists reviews_klant_idx on public.reviews (klant_id);
create index if not exists reviews_gepubliceerd_idx on public.reviews (gepubliceerd) where gepubliceerd;

alter table public.reviews enable row level security;

-- Moment van levering: daarop telt de NPS-mail de wachtdagen af. Een trigger zet het
-- veld zodra een order een geleverde status krijgt, ongeacht welke code de status zet.
-- Bestaande orders krijgen bewust geen datum: die krijgen dus geen NPS-mail achteraf.
alter table public.orders add column if not exists geleverd_op timestamptz;

create or replace function public.orders_zet_geleverd_op()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('compleet_geleverd', 'verzonden', 'factureren', 'afgerond') and new.geleverd_op is null then
    new.geleverd_op := now();
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_geleverd_op_trg') then
    create trigger orders_geleverd_op_trg
      before insert or update of status on public.orders
      for each row execute function public.orders_zet_geleverd_op();
  end if;
end $$;

create index if not exists orders_geleverd_op_idx on public.orders (geleverd_op) where geleverd_op is not null;

-- ---------------------------------------------------------------------------
-- 3. Nieuwsbrief: double opt-in
-- ---------------------------------------------------------------------------
alter table public.nieuwsbrief_inschrijvingen add column if not exists bevestigd_op timestamptz;
alter table public.nieuwsbrief_inschrijvingen add column if not exists bevestig_token text;
alter table public.nieuwsbrief_inschrijvingen add column if not exists bevestiging_verstuurd_op timestamptz;
create unique index if not exists idx_nieuwsbrief_bevestig_token on public.nieuwsbrief_inschrijvingen (bevestig_token);

-- Bestaande inschrijvingen blijven geldig: ze tellen als bevestigd op hun aanmelddatum.
update public.nieuwsbrief_inschrijvingen
   set bevestigd_op = created_at
 where bevestigd_op is null
   and bevestig_token is null;
