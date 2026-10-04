-- HR-koppeling en open API (in- en uitdienst van medewerkers).
-- Alleen toevoegen, idempotent.
--
-- medewerkers had al personeelsnummer, email, functie, afdeling_id, datum_in_dienst,
-- datum_uit_dienst en actief. Erbij: waar de gegevens vandaan komen (bron) en wanneer
-- ze voor het laatst zijn bijgewerkt.

alter table public.medewerkers add column if not exists bron text not null default 'handmatig';
alter table public.medewerkers add column if not exists bijgewerkt_op timestamptz;

-- Opzoeken op personeelsnummer of e-mail binnen één klant (idempotent aanmaken).
-- Bewust geen unique index: handmatige invoer en Excel-plakken mogen niet ineens falen
-- op een dubbel nummer. De API en de CSV-import bewaken dat zelf.
create index if not exists medewerkers_org_personeelsnummer_idx on public.medewerkers (organisatie_id, personeelsnummer);
create index if not exists medewerkers_org_email_idx on public.medewerkers (organisatie_id, lower(email));

-- ---------------------------------------------------------------- api_sleutels
-- Eén of meer sleutels per klantorganisatie. We bewaren alleen de SHA-256-hash en de
-- laatste 4 tekens; de sleutel zelf zien we één keer, bij het aanmaken.
create table if not exists public.api_sleutels (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  naam text not null,
  hash text not null unique,
  laatste4 text not null,
  scopes text[] not null default array['medewerkers:lezen', 'medewerkers:schrijven'],
  aangemaakt_door text,
  created_at timestamptz not null default now(),
  laatst_gebruikt timestamptz,
  ingetrokken_op timestamptz
);
create index if not exists api_sleutels_org_idx on public.api_sleutels (organisatie_id);
alter table public.api_sleutels enable row level security;

-- ---------------------------------------------------------------- api_log
-- Elk API-verzoek (ook mislukte), plus CSV-importen. Dient ook als teller voor de
-- rate limit (verzoeken per sleutel per minuut). Kale uuid's zonder FK: het logboek
-- moet blijven staan als een sleutel of medewerker verdwijnt.
create table if not exists public.api_log (
  id uuid primary key default gen_random_uuid(),
  sleutel_id uuid,
  organisatie_id uuid,
  methode text,
  pad text,
  status integer,
  actie text,
  medewerker_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists api_log_sleutel_tijd_idx on public.api_log (sleutel_id, created_at desc);
create index if not exists api_log_org_tijd_idx on public.api_log (organisatie_id, created_at desc);
alter table public.api_log enable row level security;
