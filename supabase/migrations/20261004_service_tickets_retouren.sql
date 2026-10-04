-- Service: klachten als eenvoudig ticket-systeem, gesprekstijdlijn, en retourbeslissingen.
-- Alleen toevoegen, idempotent. De code werkt ook zonder deze migratie (terugval op de oude kolommen).
--
-- Let op foreign keys: klachten en retouren verwijzen al naar orders, organisaties en medewerkers.
-- Daar komt GEEN tweede FK naar bij (dat breekt PostgREST-embeds met PGRST201). Daarom zijn
-- retouren.vervolg_order_id en retouren.creditfactuur_id kale uuid-kolommen zonder FK.

-- ---------------------------------------------------------------- klachten
alter table public.klachten add column if not exists categorie text;
alter table public.klachten add column if not exists prioriteit text not null default 'normaal';
-- Interne collega (taak_personen). Klachten verwijst nog niet naar taak_personen, dus één FK mag.
alter table public.klachten add column if not exists toegewezen_aan uuid references public.taak_personen(id) on delete set null;
-- Streeftijd voor de eerste reactie, gezet bij aanmaken op basis van prioriteit.
alter table public.klachten add column if not exists sla_reactie_voor timestamptz;
alter table public.klachten add column if not exists eerste_reactie_op timestamptz;
alter table public.klachten add column if not exists oorzaak text;
alter table public.klachten add column if not exists oplossing text;
alter table public.klachten add column if not exists opgelost_op timestamptz;
-- Koppeling aan een artikel (klachten verwijst nog niet naar producten).
alter table public.klachten add column if not exists product_id uuid references public.producten(id) on delete set null;
-- Contactpersoon bij de klant (klachten verwijst nog niet naar contactpersonen).
alter table public.klachten add column if not exists contact_id uuid references public.contactpersonen(id) on delete set null;
alter table public.klachten add column if not exists contact_naam text;
-- Hoe kwam het binnen: portaal, telefoon, mail, balie.
alter table public.klachten add column if not exists bron text not null default 'portaal';

create index if not exists klachten_status_idx on public.klachten (status);
create index if not exists klachten_categorie_idx on public.klachten (categorie);
create index if not exists klachten_toegewezen_idx on public.klachten (toegewezen_aan);

-- ---------------------------------------------------------------- klacht_berichten
-- Gesprekstijdlijn. soort: 'antwoord' (zichtbaar in het portaal), 'notitie' (alleen intern),
-- 'klant' (reactie van de klant vanuit het portaal).
create table if not exists public.klacht_berichten (
  id uuid primary key default gen_random_uuid(),
  klacht_id uuid not null references public.klachten(id) on delete cascade,
  soort text not null default 'notitie' check (soort in ('antwoord', 'notitie', 'klant')),
  tekst text not null,
  auteur text,
  gemaild_op timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists klacht_berichten_klacht_idx on public.klacht_berichten (klacht_id, created_at);

-- RLS aan zonder policies: lezen en schrijven gaat via de service role (dashboard) of via de
-- server, nadat het portaal met RLS heeft gecontroleerd dat de klacht van de eigen organisatie is.
alter table public.klacht_berichten enable row level security;

-- ---------------------------------------------------------------- retouren
-- beslissing: 'goedkeuren' | 'afkeuren' | 'omruilen' | 'creditnota'
alter table public.retouren add column if not exists beslissing text;
alter table public.retouren add column if not exists beslissing_notitie text;
alter table public.retouren add column if not exists afgehandeld_op timestamptz;
-- Vervolgacties. Bewust zonder FK (retouren verwijst al naar orders).
alter table public.retouren add column if not exists vervolg_order_id uuid;
alter table public.retouren add column if not exists creditfactuur_id uuid;
alter table public.retouren add column if not exists taak_id uuid;
-- Foto's die het portaal meestuurt: lijst met publieke URL's of opslagpaden.
alter table public.retouren add column if not exists fotos jsonb;

create index if not exists retouren_status_idx on public.retouren (status);
