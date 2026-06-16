-- KMS/ERP fundament (toegepast op Supabase 16 juni 2026).
-- 1. Klantgegevens + klantinstellingen
alter table public.organisaties
  add column if not exists klantnummer text,
  add column if not exists bezoekadres text,
  add column if not exists postadres text,
  add column if not exists land text default 'Nederland',
  add column if not exists kvk text,
  add column if not exists btw_nummer text,
  add column if not exists contactpersoon text,
  add column if not exists functie_contactpersoon text,
  add column if not exists mobiel text,
  add column if not exists email_algemeen text,
  add column if not exists factuur_email text,
  add column if not exists website text,
  add column if not exists actief boolean not null default true,
  add column if not exists datum_klant date,
  add column if not exists accountmanager text,
  add column if not exists opmerkingen text,
  add column if not exists interne_notities text,
  add column if not exists budget_actief boolean not null default true,
  add column if not exists goedkeuren_bestellingen boolean not null default false,
  add column if not exists levering text not null default 'per_werknemer',
  add column if not exists facturatie_wijze text not null default 'per_order';

create table if not exists public.afdelingen (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  naam text not null, kostenplaats text, leidinggevende text, opmerkingen text,
  created_at timestamptz not null default now());

alter table public.medewerkers
  add column if not exists personeelsnummer text, add column if not exists voornaam text,
  add column if not exists tussenvoegsel text, add column if not exists achternaam text,
  add column if not exists adres text, add column if not exists postcode text,
  add column if not exists plaats text, add column if not exists land text,
  add column if not exists email text, add column if not exists telefoon text,
  add column if not exists afdeling_id uuid references public.afdelingen(id) on delete set null,
  add column if not exists datum_in_dienst date, add column if not exists datum_uit_dienst date,
  add column if not exists actief boolean not null default true, add column if not exists opmerkingen text;

-- 2. Leveranciers, producten, varianten, assortiment
create table if not exists public.leveranciers (
  id uuid primary key default gen_random_uuid(), leveranciersnummer text, naam text not null,
  contactpersoon text, telefoon text, email text, levertijd_dagen integer, betaalcondities text,
  merken text[] default '{}', created_at timestamptz not null default now());

create table if not exists public.producten (
  id uuid primary key default gen_random_uuid(), sku text, ean text, art_nr_leverancier text,
  naam text not null, omschrijving text, merk text, categorie text, subcategorie text, geslacht text,
  normeringen text, materiaal text, btw numeric not null default 21,
  leverancier_id uuid references public.leveranciers(id) on delete set null,
  afbeeldingen text[] default '{}', actief boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists public.product_varianten (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.producten(id) on delete cascade,
  maat text, kleur text, ean text, inkoopprijs numeric, verkoopprijs numeric,
  meerprijs numeric not null default 0, voorraad integer not null default 0,
  actief boolean not null default true, created_at timestamptz not null default now());

create table if not exists public.assortiment (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  product_id uuid not null references public.producten(id) on delete cascade,
  afdeling_id uuid references public.afdelingen(id) on delete cascade,
  medewerker_id uuid references public.medewerkers(id) on delete cascade,
  toegestaan boolean not null default true, created_at timestamptz not null default now());

-- 3. Logos, orders, orderregels, decoraties, inkoop
create table if not exists public.logos (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  naam text not null, logo_bestand_url text, vectorbestand_url text, borduurbestand_url text,
  opmerkingen text, created_at timestamptz not null default now());

create sequence if not exists public.ordernummer_seq start 1001;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ordernummer integer not null default nextval('public.ordernummer_seq'),
  organisatie_id uuid not null references public.organisaties(id) on delete restrict,
  medewerker_id uuid references public.medewerkers(id) on delete set null,
  afdeling_id uuid references public.afdelingen(id) on delete set null,
  besteldatum timestamptz not null default now(), status text not null default 'concept',
  goedkeuring_status text not null default 'niet_nodig', goedgekeurd_door text, bedrag numeric,
  aangevraagd_door text, notitie text, interne_notitie text, created_at timestamptz not null default now());

create table if not exists public.orderregels (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.producten(id) on delete set null,
  variant_id uuid references public.product_varianten(id) on delete set null,
  item_naam text not null, maat text, kleur text, aantal integer not null default 1,
  stukprijs numeric, created_at timestamptz not null default now());

create table if not exists public.regel_decoraties (
  id uuid primary key default gen_random_uuid(),
  orderregel_id uuid not null references public.orderregels(id) on delete cascade,
  logo_id uuid references public.logos(id) on delete set null,
  techniek text, positie text, afmeting text, opmerkingen text,
  created_at timestamptz not null default now());

create table if not exists public.inkoopregels (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  orderregel_id uuid references public.orderregels(id) on delete set null,
  product_id uuid references public.producten(id) on delete set null,
  variant_id uuid references public.product_varianten(id) on delete set null,
  leverancier_id uuid references public.leveranciers(id) on delete set null,
  merk text, item_naam text, maat text, kleur text, aantal integer not null default 1,
  status text not null default 'te_bestellen', besteld_op date, geleverd_aantal integer not null default 0,
  created_at timestamptz not null default now());

-- 4. Facturatie
create sequence if not exists public.factuurnummer_seq start 1;
create table if not exists public.facturen (
  id uuid primary key default gen_random_uuid(),
  factuurnummer text not null default ('FR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.factuurnummer_seq')::text, 4, '0')),
  organisatie_id uuid not null references public.organisaties(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  factuurdatum date not null default current_date, vervaldatum date,
  bedrag_excl numeric not null default 0, btw_bedrag numeric not null default 0,
  bedrag_incl numeric not null default 0, status text not null default 'concept',
  factuur_email text, betaaldatum date, toegepaste_prijsafspraken text,
  created_at timestamptz not null default now());

create table if not exists public.factuurregels (
  id uuid primary key default gen_random_uuid(),
  factuur_id uuid not null references public.facturen(id) on delete cascade,
  omschrijving text not null, aantal numeric not null default 1, stukprijs numeric not null default 0,
  btw_pct numeric not null default 21, bedrag numeric not null default 0);

-- 5. RLS klantzijde (zie applied migration kms_rls_klantzijde voor policies)
