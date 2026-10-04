-- Sparen uitgebouwd tot loyaliteitsprogramma: spaarregels, niveaus, beloningen,
-- een puntengrootboek en aangebrachte klanten. Alleen toevoegen, idempotent.
--
-- Alle tabellen hebben RLS aan zonder policies (net als spaar_inwisselingen):
-- lezen en schrijven gaat via de service role (kmsAdmin) in het dashboard en in
-- de server-code van het portaal, altijd gefilterd op de eigen organisatie.
--
-- Foreign keys: per tabel hoogstens één FK naar dezelfde doeltabel, zodat
-- bestaande PostgREST-embeds niet dubbelzinnig worden (PGRST201).
-- Kolommen als order_id, factuur_id, taak_id en nieuwe_organisatie_id hebben
-- bewust geen FK.

-- 1. Spaarregels -------------------------------------------------------------
create table if not exists public.spaar_regels (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  -- per_euro | drempel_bonus | eerste_order | aanbrengen | review | jubileum | nabestellen | periode_actie
  soort text not null,
  actief boolean not null default true,
  punten integer not null default 0,
  factor numeric not null default 1,
  drempel_euro numeric,
  maanden integer,
  start_datum date,
  eind_datum date,
  -- Regel geldt voor orders (of jubilea) vanaf deze datum. Leeg = altijd.
  geldig_vanaf date,
  -- Tekst die de klant in het portaal ziet ("Zo spaar je").
  omschrijving text,
  -- De basisregel (punten per euro) is gekoppeld aan instellingen.spaar_punten_per_euro.
  systeem boolean not null default false,
  sortering integer not null default 0,
  created_at timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);
alter table public.spaar_regels enable row level security;

-- 2. Niveaus -----------------------------------------------------------------
create table if not exists public.spaar_niveaus (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  -- Drempel in euro omzet of in punten per 12 maanden (instelling spaar_niveau_basis).
  drempel numeric not null default 0,
  kleur text,
  korting_pct numeric not null default 0,
  -- Extra punten op de basisregel, bijv. 1.25 = 25% meer punten per euro.
  punten_factor numeric not null default 1,
  gratis_logo boolean not null default false,
  gratis_passen boolean not null default false,
  voorrang boolean not null default false,
  extra_voordelen text,
  sortering integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.spaar_niveaus enable row level security;

-- 3. Beloningencatalogus ----------------------------------------------------
create table if not exists public.spaar_beloningen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  -- korting_euro | gratis_artikel | gratis_logo | cadeaubon | goed_doel | anders
  soort text not null default 'korting_euro',
  omschrijving text,
  punten_prijs integer not null,
  waarde_euro numeric not null default 0,
  min_niveau_id uuid references public.spaar_niveaus(id) on delete set null,
  actief boolean not null default true,
  in_portaal boolean not null default true,
  voorraad integer,
  sortering integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.spaar_beloningen enable row level security;

-- 4. Puntengrootboek --------------------------------------------------------
create table if not exists public.spaar_mutaties (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  -- Positief bij bijboeken, negatief bij afboeken en vervallen.
  punten integer not null,
  -- bij | af | vervallen
  soort text not null,
  regel_id uuid references public.spaar_regels(id) on delete set null,
  regel_soort text,
  order_id uuid,
  -- Idempotentiesleutel voor automatische boekingen (order, jubileum, aanbrengen, verval).
  sleutel text,
  omschrijving text,
  reden text,
  door text,
  -- Boekdatum; voor orderpunten de besteldatum. Telt voor de vervaltermijn.
  datum timestamptz not null default now(),
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.spaar_mutaties enable row level security;
create unique index if not exists spaar_mutaties_sleutel_uniek on public.spaar_mutaties (sleutel);
create index if not exists spaar_mutaties_org_idx on public.spaar_mutaties (organisatie_id, datum);
create index if not exists spaar_mutaties_order_idx on public.spaar_mutaties (order_id);

-- 5. Aangebrachte klanten (referral) ----------------------------------------
create table if not exists public.spaar_aanbrengingen (
  id uuid primary key default gen_random_uuid(),
  -- De klant die aanbracht en de punten krijgt.
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  -- De nieuwe klant; bewust zonder FK (tweede verwijzing naar organisaties).
  nieuwe_organisatie_id uuid,
  nieuwe_naam text,
  -- wacht | beloond | vervallen
  status text not null default 'wacht',
  punten integer not null default 0,
  notitie text,
  door text,
  beloond_op timestamptz,
  created_at timestamptz not null default now()
);
alter table public.spaar_aanbrengingen enable row level security;
create index if not exists spaar_aanbrengingen_org_idx on public.spaar_aanbrengingen (organisatie_id);

-- 6. Inwisselingen: status en koppelingen -----------------------------------
alter table public.spaar_inwisselingen add column if not exists beloning_id uuid references public.spaar_beloningen(id) on delete set null;
alter table public.spaar_inwisselingen add column if not exists beloning_naam text;
-- aangevraagd | goedgekeurd | verwerkt | afgewezen. Bestaande rijen waren direct verwerkt.
alter table public.spaar_inwisselingen add column if not exists status text not null default 'verwerkt';
alter table public.spaar_inwisselingen add column if not exists bron text not null default 'dashboard';
alter table public.spaar_inwisselingen add column if not exists aangevraagd_door text;
alter table public.spaar_inwisselingen add column if not exists notitie text;
alter table public.spaar_inwisselingen add column if not exists behandeld_door text;
alter table public.spaar_inwisselingen add column if not exists goedgekeurd_op timestamptz;
alter table public.spaar_inwisselingen add column if not exists verwerkt_op timestamptz;
alter table public.spaar_inwisselingen add column if not exists afgewezen_reden text;
alter table public.spaar_inwisselingen add column if not exists factuur_id uuid;
alter table public.spaar_inwisselingen add column if not exists taak_id uuid;
create index if not exists spaar_inwisselingen_org_idx on public.spaar_inwisselingen (organisatie_id);
create index if not exists spaar_inwisselingen_status_idx on public.spaar_inwisselingen (status);

-- 7. Startinhoud --------------------------------------------------------------
-- Basisregel: neemt het huidige "punten per euro" over en geldt voor alle orders,
-- zodat bestaande saldi gelijk blijven.
insert into public.spaar_regels (naam, soort, actief, factor, systeem, sortering, omschrijving)
select 'Punten per bestede euro', 'per_euro', true,
       coalesce((select nullif(replace(waarde, ',', '.'), '')::numeric from public.instellingen where sleutel = 'spaar_punten_per_euro'), 1),
       true, 0, 'Op elke bestelling spaar je punten over het orderbedrag.'
where not exists (select 1 from public.spaar_regels where systeem = true and soort = 'per_euro');

-- Overige regels staan klaar maar uit, met geldig_vanaf vandaag: niets wordt
-- met terugwerkende kracht toegekend tot Jessi een regel aanzet.
insert into public.spaar_regels (naam, soort, actief, punten, drempel_euro, maanden, factor, geldig_vanaf, sortering, omschrijving)
select v.naam, v.soort, false, v.punten, v.drempel, v.maanden, v.factor, current_date, v.sortering, v.omschrijving
from (values
  ('Bonus bij grote bestelling', 'drempel_bonus', 250, 1000::numeric, null::integer, 1::numeric, 10, 'Bestel je voor 1.000 euro of meer in één keer, dan krijg je 250 punten extra.'),
  ('Welkomstbonus eerste bestelling', 'eerste_order', 200, null, null, 1, 20, 'Je eerste bestelling levert 200 punten extra op.'),
  ('Klant aangebracht', 'aanbrengen', 500, null, null, 1, 30, 'Breng je een bedrijf bij ons aan? Na hun eerste bestelling krijg je 500 punten.'),
  ('Review geschreven', 'review', 100, null, null, 1, 40, 'Schrijf een Google-review over ons en ontvang 100 punten.'),
  ('Jaren klant', 'jubileum', 100, null, null, 1, 50, 'Elk jaar dat je klant bent, krijg je 100 punten.'),
  ('Op tijd nabestellen', 'nabestellen', 50, null, 6, 1, 60, 'Bestel je binnen 6 maanden na je vorige bestelling opnieuw, dan krijg je 50 punten extra.'),
  ('Dubbele punten-actie', 'periode_actie', 0, null, null, 2, 70, 'Tijdens deze actie spaar je dubbele punten.')
) as v(naam, soort, punten, drempel, maanden, factor, sortering, omschrijving)
where not exists (select 1 from public.spaar_regels r where r.soort = v.soort and r.systeem = false);

insert into public.spaar_niveaus (naam, drempel, kleur, korting_pct, punten_factor, gratis_logo, gratis_passen, voorrang, sortering, extra_voordelen)
select v.naam, v.drempel, v.kleur, v.korting, v.factor, v.logo, v.passen, v.voorrang, v.sortering, v.extra
from (values
  ('Brons', 0::numeric, 'brons', 0::numeric, 1::numeric, false, false, false, 0, null::text),
  ('Zilver', 2500, 'zilver', 2, 1.1, false, true, false, 10, 'Gratis passen op locatie bij nieuwe medewerkers.'),
  ('Goud', 7500, 'goud', 5, 1.25, true, true, true, 20, 'Gratis logo aanbrengen op nabestellingen en voorrang in de planning.')
) as v(naam, drempel, kleur, korting, factor, logo, passen, voorrang, sortering, extra)
where not exists (select 1 from public.spaar_niveaus);

insert into public.spaar_beloningen (naam, soort, omschrijving, punten_prijs, waarde_euro, sortering)
select v.naam, v.soort, v.oms, v.prijs, v.waarde, v.sortering
from (values
  ('25 euro korting', 'korting_euro', 'Korting op je volgende factuur.', 2500, 25::numeric, 0),
  ('50 euro korting', 'korting_euro', 'Korting op je volgende factuur.', 4750, 50, 10),
  ('Gratis logo aanbrengen', 'gratis_logo', 'Wij borduren of bedrukken je logo gratis op één bestelling, tot 10 stuks.', 3000, 30, 20),
  ('Cadeaubon 50 euro', 'cadeaubon', 'Een cadeaubon om in de winkel in Hengelo te besteden.', 5000, 50, 30),
  ('Donatie aan een goed doel', 'goed_doel', 'Wij maken 25 euro over aan een lokaal goed doel naar keuze.', 2500, 25, 40)
) as v(naam, soort, oms, prijs, waarde, sortering)
where not exists (select 1 from public.spaar_beloningen);
