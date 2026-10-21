-- Werkdocument Jessi (21 okt 2026), dashboard: punten 1.2, 1.4, 2.2 en 2.3.

-- 1.2 Retouren via het portaal staan bij een nieuwe klant standaard uit.
--     Bestaande klanten houden hun huidige instelling.
alter table public.organisaties alter column retouren_actief set default false;

-- 1.4 Korting per merk per klant. Gaat voor de algemene klantkorting
--     (organisaties.korting_pct) bij artikelen van dat merk.
create table if not exists public.klant_merk_kortingen (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  merk text not null check (length(trim(merk)) between 1 and 80),
  korting_pct numeric(5,2) not null check (korting_pct >= 0 and korting_pct <= 100),
  bijgewerkt_op timestamptz not null default now()
);
create unique index if not exists klant_merk_kortingen_uniek on public.klant_merk_kortingen (organisatie_id, lower(merk));
alter table public.klant_merk_kortingen enable row level security;
-- Het portaal leest alleen de kortingen van de eigen organisatie (voor de prijzen).
-- Schrijven gaat alleen via het KMS op de server (servicesleutel).
create policy klant_merk_kortingen_sel on public.klant_merk_kortingen
  for select to authenticated using (organisatie_id = private.current_org());
revoke insert, update, delete on public.klant_merk_kortingen from anon, authenticated;
revoke select on public.klant_merk_kortingen from anon;

-- 2.2 Interne productie-instructie per drukproef, apart van de opmerking voor de klant
--     (drukproeven.omschrijving). Eigen tabel zonder policy: de klant leest drukproeven
--     via zijn sessie, deze tabel alleen het KMS op de server.
create table if not exists public.drukproef_productie (
  drukproef_id uuid primary key references public.drukproeven(id) on delete cascade,
  instructie text check (instructie is null or length(instructie) <= 2000),
  bijgewerkt_op timestamptz not null default now()
);
alter table public.drukproef_productie enable row level security;
revoke all on public.drukproef_productie from anon, authenticated;

-- Bestaande proeven waarin Jessi al "Klant: ... Productie: ..." typte: splitsen.
insert into public.drukproef_productie (drukproef_id, instructie)
select d.id, nullif(trim(substring(d.omschrijving from '(?i)productie:\s*(.*)$')), '')
from public.drukproeven d
where d.omschrijving ~* 'productie:'
on conflict (drukproef_id) do nothing;

update public.drukproeven d
   set omschrijving = nullif(trim(regexp_replace(
         regexp_replace(d.omschrijving, '(?i)\s*productie:.*$', ''),
         '(?i)^\s*klant:\s*', '')), '')
 where d.omschrijving ~* 'productie:';

-- 2.3 Nieuwe drukproeven standaard op bedrukken.
alter table public.drukproeven alter column techniek set default 'bedrukken';
