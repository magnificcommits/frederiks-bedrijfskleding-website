-- Productie: logobibliotheek met meer gegevens per logo, werkbonstatus per
-- order en het moment waarop een drukproef naar de klant ging.
--
-- Alleen toevoegen, idempotent. De app werkt ook zonder deze migratie:
-- - logo's tonen dan alleen de drie vaste bestanden, zonder kleuren/posities;
-- - de werkbonplanning leidt de status af uit de order en de drukproeven;
-- - "langer dan 3 dagen open" rekent dan vanaf de aanmaakdatum.

-- 1. Logo's -------------------------------------------------------------------

alter table public.logos
  -- Extra bestanden naast de drie vaste kolommen:
  -- [{ id, url, naam, soort: 'vector'|'bitmap'|'borduur'|'overig', meta?: { breedte_px, hoogte_px, dpi }, toegevoegd_op }]
  add column if not exists bestanden jsonb not null default '[]'::jsonb,
  -- Afmetingen en dpi van de vaste bestanden, gemeten bij het uploaden:
  -- { logo?: { breedte_px, hoogte_px, dpi }, vector?: ..., borduur?: ... }
  add column if not exists bestand_meta jsonb,
  -- Huisstijlkleuren: [{ naam, pantone, hex }]
  add column if not exists kleuren jsonb not null default '[]'::jsonb,
  -- Standaardposities met maat: [{ positie, breedte_cm, hoogte_cm }]
  add column if not exists posities jsonb not null default '[]'::jsonb,
  -- Technieken waarvoor dit logo klaar is: 'borduren', 'bedrukken'
  add column if not exists technieken text[] not null default '{}'::text[],
  -- Aantal steken van het borduurprogramma (DST), voor prijs en looptijd.
  add column if not exists steken integer,
  add column if not exists bijgewerkt_op timestamptz;

create index if not exists logos_organisatie_idx on public.logos (organisatie_id);
create index if not exists regel_decoraties_logo_idx on public.regel_decoraties (logo_id) where logo_id is not null;

-- 2. Drukproeven --------------------------------------------------------------

alter table public.drukproeven
  add column if not exists verstuurd_op timestamptz;

create index if not exists drukproeven_status_idx on public.drukproeven (status, created_at desc);
create index if not exists drukproeven_order_idx on public.drukproeven (order_id) where order_id is not null;

-- 3. Werkbonnen ---------------------------------------------------------------
-- Eén rij per order met bedruk- of borduurwerk. Eigen tabel in plaats van extra
-- kolommen op orders: zo blijft orders zelf ongemoeid. Er is precies één
-- foreign key tussen werkbonnen en orders, dus embeds blijven eenduidig.

create table if not exists public.werkbonnen (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null default 'wacht_op_drukproef'
    check (status in ('wacht_op_drukproef', 'goedgekeurd', 'in_productie', 'klaar')),
  deadline date,
  notitie text,
  gestart_op timestamptz,
  klaar_op timestamptz,
  bijgewerkt_op timestamptz not null default now()
);

create index if not exists werkbonnen_status_idx on public.werkbonnen (status);
create index if not exists werkbonnen_deadline_idx on public.werkbonnen (deadline) where deadline is not null;

-- Alleen de dashboardserver (service role) leest en schrijft hier.
alter table public.werkbonnen enable row level security;
