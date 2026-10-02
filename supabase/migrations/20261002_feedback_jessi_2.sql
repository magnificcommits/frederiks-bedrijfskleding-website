-- Feedback Jessi 2 okt 2026: schema voor alle fases. Alleen toevoegingen, niets verwijderd.

-- Klanten: één facturatiecontact per klant; dat e-mailadres gaat op de factuur.
alter table public.contactpersonen add column if not exists facturatie boolean not null default false;
create unique index if not exists contactpersonen_een_facturatie on public.contactpersonen (organisatie_id) where facturatie;

-- Passessie vanuit de klant: maat per werknemer per assortimentartikel, plus kleur/lengte/opmerking.
alter table public.medewerker_maten
  add column if not exists kleur text,
  add column if not exists lengte int,
  add column if not exists opmerking text,
  add column if not exists bijgewerkt_op timestamptz not null default now();

-- Offertes: regel weet welk artikel, welke kleur en welke maat.
alter table public.offerteregels
  add column if not exists product_id uuid references public.producten(id) on delete set null,
  add column if not exists kleur text,
  add column if not exists maat text,
  add column if not exists positie int;

-- Taken: tabel zoals Notion, met automatische taken uit orders en portaalbestellingen.
alter table public.taken
  add column if not exists soort text not null default 'taak',
  add column if not exists bron text not null default 'handmatig',
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists portaal_bestelling_id uuid references public.portaal_bestellingen(id) on delete cascade,
  add column if not exists tijd time;
do $$ begin
  alter table public.taken add constraint taken_soort_chk check (soort in ('taak','afspraak'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.taken add constraint taken_bron_chk check (bron in ('handmatig','order','portaal','inkoop','offerte'));
exception when duplicate_object then null; end $$;
create unique index if not exists taken_uniek_order on public.taken (order_id) where bron = 'order';
create unique index if not exists taken_uniek_portaal on public.taken (portaal_bestelling_id) where bron = 'portaal';

-- Drukproeven: echte artikelfoto in klantkleur, achterkant, en logoplaatsing (x/y/schaal/rotatie per zijde).
alter table public.drukproeven
  add column if not exists product_kleur text,
  add column if not exists achter_afbeelding_url text,
  add column if not exists ontwerp jsonb;

-- Nieuwsbrief-editor (structuren/blokken/modules) en verzending.
create table if not exists public.nieuwsbrieven (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  onderwerp text,
  preheader text,
  afzender_naam text,
  ontwerp jsonb not null default '{}'::jsonb,
  is_template boolean not null default false,
  status text not null default 'concept' check (status in ('concept','gepland','verzenden','verzonden','mislukt')),
  doelgroep jsonb not null default '{}'::jsonb,
  gepland_op timestamptz,
  verzonden_op timestamptz,
  aantal_ontvangers int,
  aantal_verzonden int not null default 0,
  aantal_fouten int not null default 0,
  web_token text not null default replace(gen_random_uuid()::text, '-', '') unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.nieuwsbrief_modules (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  sectie jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.nieuwsbrief_ontvangers (
  id uuid primary key default gen_random_uuid(),
  nieuwsbrief_id uuid not null references public.nieuwsbrieven(id) on delete cascade,
  email text not null,
  naam text,
  organisatie_id uuid references public.organisaties(id) on delete set null,
  status text not null default 'wachtrij' check (status in ('wachtrij','verzonden','fout','overgeslagen')),
  fout text,
  resend_id text,
  verzonden_op timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists nieuwsbrief_ontvangers_uniek on public.nieuwsbrief_ontvangers (nieuwsbrief_id, lower(email));
create index if not exists nieuwsbrief_ontvangers_wachtrij on public.nieuwsbrief_ontvangers (nieuwsbrief_id) where status = 'wachtrij';
alter table public.nieuwsbrieven enable row level security;
alter table public.nieuwsbrief_modules enable row level security;
alter table public.nieuwsbrief_ontvangers enable row level security;
-- Geen policies: alleen service-role (dashboard) komt erbij.
