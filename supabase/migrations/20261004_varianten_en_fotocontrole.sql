-- Vaste varianten (kleuren, maten, overige eigenschappen) en fotocontrole voor producten.
-- Feedback Tim, 4 okt 2026: maten en kleuren overal hetzelfde, foto's even groot en scherp,
-- en meer filters op de productenlijst.
--
-- Alleen toevoegingen. Idempotent: mag vaker gedraaid worden.
-- Nieuwe tabellen: RLS aan, GEEN policies (alles loopt via de service-role in het dashboard).
-- product_varianten.kleur en .maat blijven tekst; de vaste lijst zegt alleen welke teksten goed zijn.
-- Geen extra foreign keys naar producten/product_varianten behalve product_foto_controle.product_id
-- (die tabel verwijst verder nergens naar, dus geen dubbele embed).
--
-- Volgorde: 1 tabellen, 2 kolommen op product_varianten, 3 fotocontrole, 4 startvulling,
-- 5 views voor de productenlijst en de opschoontool, 6 functie voor het omzetten.

-- ---------------------------------------------------------------------------
-- 1. Vaste lijsten
-- ---------------------------------------------------------------------------
create table if not exists public.variant_kleuren (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  hex text not null default '#999999',
  hex2 text,
  groep text not null default 'meerkleurig',
  volgorde integer not null default 0,
  actief boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists variant_kleuren_naam_uniek on public.variant_kleuren (lower(naam));
alter table public.variant_kleuren enable row level security;

-- Aliassen: de sleutel is kleurSleutel(alias) uit lib/kms/variantenStandaard.ts
-- (kleine letters, zonder leverancierscode, scheidingstekens als "/").
create table if not exists public.variant_kleur_aliassen (
  sleutel text primary key,
  alias text not null,
  kleur_id uuid not null references public.variant_kleuren(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists variant_kleur_aliassen_kleur_idx on public.variant_kleur_aliassen (kleur_id);
alter table public.variant_kleur_aliassen enable row level security;

create table if not exists public.variant_maatreeksen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  volgorde integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists variant_maatreeksen_naam_uniek on public.variant_maatreeksen (lower(naam));
alter table public.variant_maatreeksen enable row level security;

create table if not exists public.variant_maten (
  id uuid primary key default gen_random_uuid(),
  reeks_id uuid not null references public.variant_maatreeksen(id) on delete cascade,
  maat text not null,
  volgorde integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists variant_maten_uniek on public.variant_maten (reeks_id, lower(maat));
alter table public.variant_maten enable row level security;

-- Een maat-alias wijst naar de maattekst, niet naar één reeks: "44" kan broek- en schoenmaat zijn.
create table if not exists public.variant_maat_aliassen (
  sleutel text primary key,
  alias text not null,
  maat text not null,
  created_at timestamptz not null default now()
);
alter table public.variant_maat_aliassen enable row level security;

create table if not exists public.variant_eigenschappen (
  id uuid primary key default gen_random_uuid(),
  soort text not null check (soort in ('lengte', 'pasvorm')),
  waarde text not null,
  volgorde integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists variant_eigenschappen_uniek on public.variant_eigenschappen (soort, lower(waarde));
alter table public.variant_eigenschappen enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Oorspronkelijke leverancierswaarde bewaren bij het omzetten
-- ---------------------------------------------------------------------------
-- "9504 - Navy\Black" bevat de kleurcode die je bij Snickers bestelt. Die gaat niet
-- verloren: bij het omzetten komt de ruwe waarde hier, de standaardnaam in kleur.
alter table public.product_varianten
  add column if not exists kleur_leverancier text,
  add column if not exists maat_leverancier text;

create index if not exists product_varianten_kleur_idx on public.product_varianten (kleur);
create index if not exists product_varianten_maat_idx on public.product_varianten (maat);

-- ---------------------------------------------------------------------------
-- 3. Fotocontrole: gemeten in de browser, hier bewaard
-- ---------------------------------------------------------------------------
create table if not exists public.product_foto_controle (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.producten(id) on delete cascade,
  kleur text,
  url text not null,
  breedte integer,
  hoogte integer,
  bytes integer,
  -- Variantie van de Laplace-filter op een versie van 600 px; onder ~40 is het vaak wazig.
  scherpte numeric,
  -- Aandeel (0-1) van het beeld dat witte rand is, en hoe ver het product uit het midden staat.
  witruimte numeric,
  uit_midden numeric,
  -- Deel van de langste zijde dat het product vult (0-1).
  vulling numeric,
  -- Codes: te_klein, niet_vierkant, wazig, witruimte, uit_midden, laadfout.
  problemen text[] not null default '{}',
  gemeten_op timestamptz not null default now()
);
alter table public.product_foto_controle add column if not exists vulling numeric;
create unique index if not exists product_foto_controle_uniek on public.product_foto_controle (product_id, url);
alter table public.product_foto_controle enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Startvulling (alleen als de lijsten nog leeg zijn, zodat verwijderde
--    waarden bij een tweede run niet terugkomen)
-- ---------------------------------------------------------------------------
do $seed$
begin
  if not exists (select 1 from public.variant_kleuren) then
    insert into public.variant_kleuren (naam, hex, groep, volgorde) values
      ('Zwart', '#1b1b1b', 'zwart', 10),
      ('Wit', '#ffffff', 'wit', 20),
      ('Gebroken wit', '#f2eee3', 'wit', 30),
      ('Lichtgrijs', '#c9cbcd', 'grijs', 40),
      ('IJsgrijs', '#d5d9dc', 'grijs', 50),
      ('Grijs', '#8c8f93', 'grijs', 60),
      ('Grijs gemêleerd', '#a3a3a3', 'grijs', 70),
      ('Staalgrijs', '#5d6870', 'grijs', 80),
      ('Donker staalgrijs', '#46505a', 'grijs', 90),
      ('Donkergrijs', '#4b4e53', 'grijs', 100),
      ('Oxford grijs', '#5a5f66', 'grijs', 110),
      ('Antraciet', '#36393d', 'grijs', 120),
      ('Zilver', '#b9bdc1', 'zilver', 130),
      ('Marine', '#1f2a44', 'blauw', 140),
      ('Donker marine', '#141b2d', 'blauw', 150),
      ('Marine gemêleerd', '#2f3a55', 'blauw', 160),
      ('Donkerblauw', '#1f3566', 'blauw', 170),
      ('Blauw', '#2b59c3', 'blauw', 180),
      ('Koningsblauw', '#2a4fb0', 'blauw', 190),
      ('Licht koningsblauw', '#4f7fd6', 'blauw', 200),
      ('Korenblauw', '#4a6fb5', 'blauw', 210),
      ('Helderblauw', '#1e63c6', 'blauw', 220),
      ('Diepblauw', '#1d3f8a', 'blauw', 230),
      ('Grijsblauw', '#5f7a96', 'blauw', 240),
      ('Lichtblauw', '#8db9e2', 'blauw', 250),
      ('Oceaanblauw', '#1b6f8f', 'blauw', 260),
      ('Petrol', '#1d5c6b', 'blauw', 270),
      ('Turquoise', '#00a0be', 'blauw', 280),
      ('Denim', '#3d5a80', 'blauw', 290),
      ('Indigo', '#2f3a6b', 'blauw', 300),
      ('Rood', '#c8102e', 'rood', 310),
      ('Bordeaux', '#6d1a2a', 'rood', 320),
      ('Groen', '#2e7d32', 'groen', 330),
      ('Bosgroen', '#2c4a2e', 'groen', 340),
      ('Donkergroen', '#1f3d2b', 'groen', 350),
      ('Kakigroen', '#5b5b3a', 'groen', 360),
      ('Donker kakigroen', '#45452b', 'groen', 370),
      ('Olijfgroen', '#5a5a32', 'groen', 380),
      ('Limoen', '#a4c639', 'groen', 390),
      ('Kaki', '#8b7d5b', 'beige', 400),
      ('Beige', '#d6c7a1', 'beige', 410),
      ('Zand', '#c9b48a', 'beige', 420),
      ('Camel', '#b38b59', 'bruin', 430),
      ('Taupe', '#8b7d70', 'bruin', 440),
      ('Bruin', '#6b4a2b', 'bruin', 450),
      ('Lichtbruin', '#9a6b3f', 'bruin', 460),
      ('Oranje', '#f07d00', 'oranje', 470),
      ('Fluor oranje', '#ff5f15', 'oranje', 480),
      ('Geel', '#ffd200', 'geel', 490),
      ('Fluor geel', '#e2ef00', 'geel', 500),
      ('Roze', '#e58fb0', 'roze', 510),
      ('Paars', '#6a3d8f', 'paars', 520),
      ('Meerkleurig', '#999999', 'meerkleurig', 530)
    on conflict do nothing;

    insert into public.variant_kleur_aliassen (sleutel, alias, kleur_id)
    select v.sleutel, v.alias, k.id
      from (values
        ('black', 'black', 'Zwart'),
        ('blk', 'blk', 'Zwart'),
        ('schwarz', 'schwarz', 'Zwart'),
        ('noir', 'noir', 'Zwart'),
        ('white', 'white', 'Wit'),
        ('blanc', 'blanc', 'Wit'),
        ('bone white', 'bone white', 'Gebroken wit'),
        ('off white', 'off white', 'Gebroken wit'),
        ('offwhite', 'offwhite', 'Gebroken wit'),
        ('ecru', 'ecru', 'Gebroken wit'),
        ('light grey', 'light grey', 'Lichtgrijs'),
        ('light gray', 'light gray', 'Lichtgrijs'),
        ('ash grey', 'ash grey', 'Lichtgrijs'),
        ('snow grey', 'snow grey', 'Lichtgrijs'),
        ('licht grijs', 'licht grijs', 'Lichtgrijs'),
        ('ice grey', 'ice grey', 'IJsgrijs'),
        ('ice gray', 'ice gray', 'IJsgrijs'),
        ('grey', 'grey', 'Grijs'),
        ('gray', 'gray', 'Grijs'),
        ('mid grey', 'mid grey', 'Grijs'),
        ('convoy grey', 'convoy grey', 'Grijs'),
        ('stone grey', 'stone grey', 'Grijs'),
        ('full grey', 'full grey', 'Grijs'),
        ('grey melange', 'grey melange', 'Grijs gemêleerd'),
        ('greymel', 'greymel', 'Grijs gemêleerd'),
        ('grey mel', 'grey mel', 'Grijs gemêleerd'),
        ('light grey melange', 'light grey melange', 'Grijs gemêleerd'),
        ('heather grey', 'heather grey', 'Grijs gemêleerd'),
        ('grijs melange', 'grijs melange', 'Grijs gemêleerd'),
        ('steel grey', 'steel grey', 'Staalgrijs'),
        ('steelgrey', 'steelgrey', 'Staalgrijs'),
        ('steel gray', 'steel gray', 'Staalgrijs'),
        ('dk steel grey', 'dk steel grey', 'Donker staalgrijs'),
        ('dark steel grey', 'dark steel grey', 'Donker staalgrijs'),
        ('dark grey', 'dark grey', 'Donkergrijs'),
        ('darkgrey', 'darkgrey', 'Donkergrijs'),
        ('dark gray', 'dark gray', 'Donkergrijs'),
        ('dk grey', 'dk grey', 'Donkergrijs'),
        ('donker grijs', 'donker grijs', 'Donkergrijs'),
        ('slate grey', 'slate grey', 'Donkergrijs'),
        ('storm grey', 'storm grey', 'Donkergrijs'),
        ('oxford grey', 'oxford grey', 'Oxford grijs'),
        ('oxford gray', 'oxford gray', 'Oxford grijs'),
        ('anthracite', 'anthracite', 'Antraciet'),
        ('anthracite grey', 'anthracite grey', 'Antraciet'),
        ('charcoal', 'charcoal', 'Antraciet'),
        ('antracite', 'antracite', 'Antraciet'),
        ('silver', 'silver', 'Zilver'),
        ('navy', 'navy', 'Marine'),
        ('marineblauw', 'marineblauw', 'Marine'),
        ('marine blauw', 'marine blauw', 'Marine'),
        ('navy blue', 'navy blue', 'Marine'),
        ('navy plain', 'navy plain', 'Marine'),
        ('dark navy', 'dark navy', 'Donker marine'),
        ('donker marineblauw', 'donker marineblauw', 'Donker marine'),
        ('donkermarine', 'donkermarine', 'Donker marine'),
        ('navy melange', 'navy melange', 'Marine gemêleerd'),
        ('dark navy melange', 'dark navy melange', 'Marine gemêleerd'),
        ('dark blue melange', 'dark blue melange', 'Marine gemêleerd'),
        ('dark blue', 'dark blue', 'Donkerblauw'),
        ('donker blauw', 'donker blauw', 'Donkerblauw'),
        ('blue', 'blue', 'Blauw'),
        ('royal blue', 'royal blue', 'Koningsblauw'),
        ('royalblue', 'royalblue', 'Koningsblauw'),
        ('royal', 'royal', 'Koningsblauw'),
        ('kobaltblauw', 'kobaltblauw', 'Koningsblauw'),
        ('cobalt', 'cobalt', 'Koningsblauw'),
        ('light royal blue', 'light royal blue', 'Licht koningsblauw'),
        ('cornflower blue', 'cornflower blue', 'Korenblauw'),
        ('cornflower', 'cornflower', 'Korenblauw'),
        ('true blue', 'true blue', 'Helderblauw'),
        ('deep blue', 'deep blue', 'Diepblauw'),
        ('stone blue', 'stone blue', 'Grijsblauw'),
        ('sky blue', 'sky blue', 'Lichtblauw'),
        ('light blue', 'light blue', 'Lichtblauw'),
        ('licht blauw', 'licht blauw', 'Lichtblauw'),
        ('ice blue', 'ice blue', 'Lichtblauw'),
        ('ocean', 'ocean', 'Oceaanblauw'),
        ('ocean blue', 'ocean blue', 'Oceaanblauw'),
        ('teal blue', 'teal blue', 'Petrol'),
        ('teal', 'teal', 'Petrol'),
        ('tropical blue', 'tropical blue', 'Turquoise'),
        ('turquoise blue', 'turquoise blue', 'Turquoise'),
        ('turkoois', 'turkoois', 'Turquoise'),
        ('denimblue', 'denimblue', 'Denim'),
        ('denim blue', 'denim blue', 'Denim'),
        ('blue rinse', 'blue rinse', 'Denim'),
        ('jeans', 'jeans', 'Denim'),
        ('red', 'red', 'Rood'),
        ('chili red', 'chili red', 'Rood'),
        ('signal red', 'signal red', 'Rood'),
        ('red melange', 'red melange', 'Rood'),
        ('wine', 'wine', 'Bordeaux'),
        ('burgundy', 'burgundy', 'Bordeaux'),
        ('maroon', 'maroon', 'Bordeaux'),
        ('wijnrood', 'wijnrood', 'Bordeaux'),
        ('green', 'green', 'Groen'),
        ('kelly green', 'kelly green', 'Groen'),
        ('emerald green', 'emerald green', 'Groen'),
        ('forest green', 'forest green', 'Bosgroen'),
        ('dark green', 'dark green', 'Donkergroen'),
        ('bottle green', 'bottle green', 'Donkergroen'),
        ('bottle grn', 'bottle grn', 'Donkergroen'),
        ('donker groen', 'donker groen', 'Donkergroen'),
        ('flessengroen', 'flessengroen', 'Donkergroen'),
        ('khaki green', 'khaki green', 'Kakigroen'),
        ('khakigroen', 'khakigroen', 'Kakigroen'),
        ('dk khakigreen', 'dk khakigreen', 'Donker kakigroen'),
        ('dk khaki green', 'dk khaki green', 'Donker kakigroen'),
        ('dark khaki green', 'dark khaki green', 'Donker kakigroen'),
        ('olijf', 'olijf', 'Olijfgroen'),
        ('olive', 'olive', 'Olijfgroen'),
        ('olive green', 'olive green', 'Olijfgroen'),
        ('lime', 'lime', 'Limoen'),
        ('apple green', 'apple green', 'Limoen'),
        ('limegroen', 'limegroen', 'Limoen'),
        ('khaki', 'khaki', 'Kaki'),
        ('dark khaki', 'dark khaki', 'Kaki'),
        ('khaki beige', 'khaki beige', 'Kaki'),
        ('sand', 'sand', 'Zand'),
        ('light sand', 'light sand', 'Zand'),
        ('brown', 'brown', 'Bruin'),
        ('chocolate', 'chocolate', 'Bruin'),
        ('light brown', 'light brown', 'Lichtbruin'),
        ('orange', 'orange', 'Oranje'),
        ('warm orange', 'warm orange', 'Oranje'),
        ('fluororange', 'fluororange', 'Fluor oranje'),
        ('fluor orange', 'fluor orange', 'Fluor oranje'),
        ('fluorescent orange', 'fluorescent orange', 'Fluor oranje'),
        ('fluorescent orange melange', 'fluorescent orange melange', 'Fluor oranje'),
        ('hi viz orange', 'hi viz orange', 'Fluor oranje'),
        ('hi-viz orange', 'hi-viz orange', 'Fluor oranje'),
        ('hi-vis orange', 'hi-vis orange', 'Fluor oranje'),
        ('hi vis orange', 'hi vis orange', 'Fluor oranje'),
        ('high visibility orange', 'high visibility orange', 'Fluor oranje'),
        ('fluo oranje', 'fluo oranje', 'Fluor oranje'),
        ('neon orange', 'neon orange', 'Fluor oranje'),
        ('fluor oranje', 'fluor oranje', 'Fluor oranje'),
        ('yellow', 'yellow', 'Geel'),
        ('fluorescent yellow', 'fluorescent yellow', 'Fluor geel'),
        ('fluorescent yellow melange', 'fluorescent yellow melange', 'Fluor geel'),
        ('fluor yellow', 'fluor yellow', 'Fluor geel'),
        ('hi viz yellow', 'hi viz yellow', 'Fluor geel'),
        ('hi-viz yellow', 'hi-viz yellow', 'Fluor geel'),
        ('hi-vis geel', 'hi-vis geel', 'Fluor geel'),
        ('hi-vis yellow', 'hi-vis yellow', 'Fluor geel'),
        ('hi vis yellow', 'hi vis yellow', 'Fluor geel'),
        ('high visibility yellow', 'high visibility yellow', 'Fluor geel'),
        ('neon yellow', 'neon yellow', 'Fluor geel'),
        ('fluo geel', 'fluo geel', 'Fluor geel'),
        ('pink', 'pink', 'Roze'),
        ('purple', 'purple', 'Paars'),
        ('multicolour', 'multicolour', 'Meerkleurig'),
        ('multicolor', 'multicolor', 'Meerkleurig'),
        ('multi', 'multi', 'Meerkleurig')
      ) as v(sleutel, alias, naam)
      join public.variant_kleuren k on lower(k.naam) = lower(v.naam)
    on conflict do nothing;

  end if;
end
$seed$;

-- Maten apart, met eigen controle.
do $seedmaten$
begin
  if not exists (select 1 from public.variant_maatreeksen) then
    insert into public.variant_maatreeksen (naam, volgorde) values
      ('Confectie', 10),
      ('Combimaten', 20),
      ('Broekmaten', 30),
      ('Korte maten (buikmaten)', 40),
      ('Lange maten', 50),
      ('Schoenmaten', 60),
      ('One size', 70)
    on conflict do nothing;

    insert into public.variant_maten (reeks_id, maat, volgorde)
    select r.id, v.maat, v.volgorde
      from (values
        ('Confectie', 'XXS', 10),
        ('Confectie', 'XS', 20),
        ('Confectie', 'S', 30),
        ('Confectie', 'M', 40),
        ('Confectie', 'L', 50),
        ('Confectie', 'XL', 60),
        ('Confectie', '2XL', 70),
        ('Confectie', '3XL', 80),
        ('Confectie', '4XL', 90),
        ('Confectie', '5XL', 100),
        ('Confectie', '6XL', 110),
        ('Confectie', '7XL', 120),
        ('Confectie', '8XL', 130),
        ('Combimaten', 'XS/S', 10),
        ('Combimaten', 'S/M', 20),
        ('Combimaten', 'M/L', 30),
        ('Combimaten', 'L/XL', 40),
        ('Combimaten', 'XL/2XL', 50),
        ('Combimaten', '2XL/3XL', 60),
        ('Combimaten', '3XL/4XL', 70),
        ('Combimaten', '4XL/5XL', 80),
        ('Broekmaten', '34', 10),
        ('Broekmaten', '36', 20),
        ('Broekmaten', '38', 30),
        ('Broekmaten', '40', 40),
        ('Broekmaten', '42', 50),
        ('Broekmaten', '44', 60),
        ('Broekmaten', '46', 70),
        ('Broekmaten', '48', 80),
        ('Broekmaten', '50', 90),
        ('Broekmaten', '52', 100),
        ('Broekmaten', '54', 110),
        ('Broekmaten', '56', 120),
        ('Broekmaten', '58', 130),
        ('Broekmaten', '60', 140),
        ('Broekmaten', '62', 150),
        ('Broekmaten', '64', 160),
        ('Broekmaten', '66', 170),
        ('Broekmaten', '68', 180),
        ('Broekmaten', '70', 190),
        ('Broekmaten', '72', 200),
        ('Korte maten (buikmaten)', '23', 10),
        ('Korte maten (buikmaten)', '24', 20),
        ('Korte maten (buikmaten)', '25', 30),
        ('Korte maten (buikmaten)', '26', 40),
        ('Korte maten (buikmaten)', '27', 50),
        ('Korte maten (buikmaten)', '28', 60),
        ('Korte maten (buikmaten)', '29', 70),
        ('Korte maten (buikmaten)', '30', 80),
        ('Korte maten (buikmaten)', '31', 90),
        ('Korte maten (buikmaten)', '32', 100),
        ('Korte maten (buikmaten)', '33', 110),
        ('Korte maten (buikmaten)', '34', 120),
        ('Korte maten (buikmaten)', '35', 130),
        ('Lange maten', '84', 10),
        ('Lange maten', '86', 20),
        ('Lange maten', '88', 30),
        ('Lange maten', '90', 40),
        ('Lange maten', '92', 50),
        ('Lange maten', '94', 60),
        ('Lange maten', '96', 70),
        ('Lange maten', '98', 80),
        ('Lange maten', '100', 90),
        ('Lange maten', '102', 100),
        ('Lange maten', '104', 110),
        ('Lange maten', '106', 120),
        ('Lange maten', '108', 130),
        ('Lange maten', '110', 140),
        ('Lange maten', '112', 150),
        ('Lange maten', '114', 160),
        ('Lange maten', '116', 170),
        ('Lange maten', '118', 180),
        ('Lange maten', '120', 190),
        ('Lange maten', '122', 200),
        ('Lange maten', '124', 210),
        ('Lange maten', '126', 220),
        ('Lange maten', '128', 230),
        ('Schoenmaten', '35', 10),
        ('Schoenmaten', '36', 20),
        ('Schoenmaten', '37', 30),
        ('Schoenmaten', '38', 40),
        ('Schoenmaten', '39', 50),
        ('Schoenmaten', '40', 60),
        ('Schoenmaten', '41', 70),
        ('Schoenmaten', '42', 80),
        ('Schoenmaten', '43', 90),
        ('Schoenmaten', '44', 100),
        ('Schoenmaten', '45', 110),
        ('Schoenmaten', '46', 120),
        ('Schoenmaten', '47', 130),
        ('Schoenmaten', '48', 140),
        ('Schoenmaten', '49', 150),
        ('Schoenmaten', '50', 160),
        ('One size', 'One size', 10)
      ) as v(reeks, maat, volgorde)
      join public.variant_maatreeksen r on lower(r.naam) = lower(v.reeks)
    on conflict do nothing;

    insert into public.variant_maat_aliassen (sleutel, alias, maat) values
      ('2xs', '2xs', 'XXS'),
      ('xxl', 'xxl', '2XL'),
      ('xxxl', 'xxxl', '3XL'),
      ('xxxxl', 'xxxxl', '4XL'),
      ('xxxxxl', 'xxxxxl', '5XL'),
      ('xxxxxxl', 'xxxxxxl', '6XL'),
      ('xl/xxl', 'xl/xxl', 'XL/2XL'),
      ('xxl/3xl', 'xxl/3xl', '2XL/3XL'),
      ('xxl/xxxl', 'xxl/xxxl', '2XL/3XL'),
      ('xxxl/4xl', 'xxxl/4xl', '3XL/4XL'),
      ('onesize', 'onesize', 'One size'),
      ('one size', 'one size', 'One size'),
      ('one-size', 'one-size', 'One size'),
      ('os', 'os', 'One size'),
      ('uni', 'uni', 'One size'),
      ('universeel', 'universeel', 'One size')
    on conflict do nothing;

    insert into public.variant_eigenschappen (soort, waarde, volgorde) values
      ('lengte', 'Kort', 10),
      ('lengte', 'Normaal', 20),
      ('lengte', 'Lang', 30),
      ('lengte', 'Extra lang', 40),
      ('pasvorm', 'Regular fit', 10),
      ('pasvorm', 'Slim fit', 20),
      ('pasvorm', 'Loose fit', 30),
      ('pasvorm', 'Dames', 40)
    on conflict do nothing;
  end if;
end
$seedmaten$;

-- ---------------------------------------------------------------------------
-- 5. Views
-- ---------------------------------------------------------------------------
-- Eén rij per product met wat de productenlijst wil filteren: kleuren en maten uit
-- de varianten, voorraad, vanafprijs, aantal foto's, bij welke klanten het product in
-- het assortiment zit en welke fotoproblemen er gemeten zijn. Zo filtert PostgREST
-- alles in één query, zonder honderden product-id's in de URL.
-- Eerst weggooien: p.* verandert mee met nieuwe kolommen op producten, en dan weigert
-- "create or replace view" bij een tweede run.
drop view if exists public.producten_overzicht;
create view public.producten_overzicht
with (security_invoker = true) as
select
  p.*,
  coalesce(v.aantal, 0)::integer as aantal_varianten,
  coalesce(v.kleuren, '') as variant_kleuren,
  coalesce(v.maten, '{}'::text[]) as variant_maten,
  coalesce(v.voorraad, 0)::integer as voorraad_totaal,
  coalesce(v.prijs_min, p.verkoopprijs_basis) as prijs_vanaf,
  -- Alleen echte adressen tellen; bij de import kwamen er ook teksten als "Nog niet beschikbaar" in.
  ((select count(*) from unnest(coalesce(p.afbeeldingen, '{}'::text[])) as u(url) where u.url ~ '^(https?://|/)')
    + coalesce(k.aantal, 0))::integer as aantal_fotos,
  coalesce(a.klanten, '{}'::uuid[]) as assortiment_klanten,
  coalesce(f.problemen, '{}'::text[]) as foto_problemen
from public.producten p
left join lateral (
  select count(*) as aantal,
         -- Huidige en oorspronkelijke kleur, zodat "black" ook na het omzetten nog vindt.
         string_agg(distinct lower(concat_ws(' | ', pv.kleur, pv.kleur_leverancier)), ' | ') as kleuren,
         array_agg(distinct pv.maat) filter (where pv.maat is not null) as maten,
         sum(greatest(pv.voorraad, 0)) as voorraad,
         min(pv.verkoopprijs) filter (where pv.verkoopprijs > 0) as prijs_min
    from public.product_varianten pv
   where pv.product_id = p.id
) v on true
left join lateral (
  select count(*) as aantal
    from public.product_kleur_afbeeldingen pk
   where pk.product_id = p.id and coalesce(pk.afbeelding_url, '') <> ''
) k on true
left join lateral (
  select array_agg(distinct asr.organisatie_id) as klanten
    from public.assortiment asr
   where asr.product_id = p.id and asr.toegestaan is not false and asr.organisatie_id is not null
) a on true
left join lateral (
  select array_agg(distinct pr) as problemen
    from public.product_foto_controle c, unnest(c.problemen) as pr
   where c.product_id = p.id
) f on true;

revoke all on public.producten_overzicht from anon, authenticated;

-- Alle unieke kleur- en maatwaarden met aantallen, voor de opschoontool.
drop view if exists public.variant_waarden;
create view public.variant_waarden
with (security_invoker = true) as
select 'kleur'::text as veld, pv.kleur as waarde, count(*)::integer as varianten, count(distinct pv.product_id)::integer as producten
  from public.product_varianten pv where pv.kleur is not null group by pv.kleur
union all
select 'maat'::text, pv.maat, count(*)::integer, count(distinct pv.product_id)::integer
  from public.product_varianten pv where pv.maat is not null group by pv.maat;

revoke all on public.variant_waarden from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Omzetten in één transactie
-- ---------------------------------------------------------------------------
-- p_paren: [{"van": "9504 - Navy\\Black", "naar": "Marine/zwart"}, ...]
-- Per paar:
--  - varianten krijgen de standaardwaarde; de oude waarde gaat naar kleur_leverancier/maat_leverancier;
--  - een variant wordt overgeslagen als hetzelfde product al een variant met die standaardwaarde
--    (en dezelfde maat, of bij maten dezelfde kleur) heeft: anders ontstaan dubbele varianten;
--  - kleurfoto's, fotocontrole, assortiment en medewerkermaten volgen, maar alleen bij producten
--    waar de oude waarde nu helemaal weg is.
create or replace function public.varianten_omzetten(p_veld text, p_paren jsonb)
returns table (van text, naar text, omgezet integer, overgeslagen integer, fotos integer)
language plpgsql
set search_path = public
as $fn$
declare
  r record;
  n integer;
  s integer;
  f integer;
begin
  if p_veld not in ('kleur', 'maat') then
    raise exception 'Onbekend veld: %', p_veld;
  end if;

  for r in
    select e->>'van' as oud, nullif(trim(e->>'naar'), '') as nieuw
      from jsonb_array_elements(coalesce(p_paren, '[]'::jsonb)) as e
  loop
    if r.oud is null or r.nieuw is null or r.oud = r.nieuw then
      continue;
    end if;
    f := 0;

    if p_veld = 'kleur' then
      update public.product_varianten pv
         set kleur_leverancier = coalesce(pv.kleur_leverancier, pv.kleur),
             kleur = r.nieuw
       where pv.kleur = r.oud
         and not exists (
           select 1 from public.product_varianten o
            where o.product_id = pv.product_id and o.id <> pv.id
              and o.kleur = r.nieuw and o.maat is not distinct from pv.maat);
      get diagnostics n = row_count;
      select count(*)::integer into s from public.product_varianten where kleur = r.oud;

      delete from public.product_kleur_afbeeldingen k
       where k.kleur = r.oud
         and not exists (select 1 from public.product_varianten pv where pv.product_id = k.product_id and pv.kleur = r.oud)
         and exists (select 1 from public.product_kleur_afbeeldingen d where d.product_id = k.product_id and d.kleur = r.nieuw);
      update public.product_kleur_afbeeldingen k
         set kleur = r.nieuw
       where k.kleur = r.oud
         and not exists (select 1 from public.product_varianten pv where pv.product_id = k.product_id and pv.kleur = r.oud);
      get diagnostics f = row_count;

      update public.product_foto_controle c
         set kleur = r.nieuw
       where c.kleur = r.oud
         and not exists (select 1 from public.product_varianten pv where pv.product_id = c.product_id and pv.kleur = r.oud);
      update public.assortiment a
         set kleur = r.nieuw
       where a.kleur = r.oud
         and not exists (select 1 from public.product_varianten pv where pv.product_id = a.product_id and pv.kleur = r.oud);
      update public.medewerker_maten m
         set kleur = r.nieuw
       where m.kleur = r.oud
         and not exists (select 1 from public.product_varianten pv where pv.product_id = m.product_id and pv.kleur = r.oud);
    else
      update public.product_varianten pv
         set maat_leverancier = coalesce(pv.maat_leverancier, pv.maat),
             maat = r.nieuw
       where pv.maat = r.oud
         and not exists (
           select 1 from public.product_varianten o
            where o.product_id = pv.product_id and o.id <> pv.id
              and o.maat = r.nieuw and o.kleur is not distinct from pv.kleur);
      get diagnostics n = row_count;
      select count(*)::integer into s from public.product_varianten where maat = r.oud;

      update public.medewerker_maten m
         set voorkeursmaat = r.nieuw
       where m.voorkeursmaat = r.oud
         and not exists (select 1 from public.product_varianten pv where pv.product_id = m.product_id and pv.maat = r.oud);
    end if;

    van := r.oud;
    naar := r.nieuw;
    omgezet := n;
    overgeslagen := s;
    fotos := f;
    return next;
  end loop;
end
$fn$;

revoke all on function public.varianten_omzetten(text, jsonb) from public, anon, authenticated;
grant execute on function public.varianten_omzetten(text, jsonb) to service_role;
