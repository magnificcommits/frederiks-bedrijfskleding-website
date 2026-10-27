-- Werkdocument Jessi (27 okt 2026), punt 1.5: offerte digitaal goedkeuren.
-- Per offerte één vastgelegd akkoord: wie, wanneer, vanaf welk adres en met
-- welke versie van de algemene voorwaarden. Dat is het bewijs dat de klant
-- akkoord gaf (artikel 2.2 van de voorwaarden).
-- Alleen het KMS op de server leest en schrijft hier (servicesleutel); geen policy.
create table if not exists public.offerte_akkoorden (
  id uuid primary key default gen_random_uuid(),
  offerte_id uuid not null unique references public.offertes(id) on delete cascade,
  naam text not null check (length(trim(naam)) between 2 and 120),
  functie text check (functie is null or length(functie) <= 120),
  email text check (email is null or length(email) <= 254),
  totaal_incl numeric(12,2),
  voorwaarden_versie text not null,
  ip text,
  user_agent text check (user_agent is null or length(user_agent) <= 400),
  akkoord_op timestamptz not null default now()
);
alter table public.offerte_akkoorden enable row level security;
revoke all on public.offerte_akkoorden from anon, authenticated;
