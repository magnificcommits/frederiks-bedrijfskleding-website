-- Personalisatiekosten automatisch (mail Jessi 21 okt 2026, "kosten voor bedrukking
-- en borduring"): centrale prijslijst, afwijkende prijzen per klant, koppeling met
-- de drukproeven en aparte regels op offerte, order en factuur.

-- 1. De centrale prijslijst bestond al in de database (augustus 2026), maar niet in
--    de repo. Voor de volledigheid hier vastgelegd; bestaat hij al, dan gebeurt er niets.
create table if not exists public.decoratie_tarieven (
  id uuid primary key default gen_random_uuid(),
  techniek text not null,
  formaat text not null,
  vanaf_aantal integer not null check (vanaf_aantal >= 1),
  stukprijs numeric not null check (stukprijs >= 0)
);
create table if not exists public.decoratie_formaten (
  id uuid primary key default gen_random_uuid(),
  techniek text not null,
  formaat text not null,
  omschrijving text,
  max_oppervlakte_cm2 integer,
  volgorde integer
);
create table if not exists public.decoratie_kosten (
  id uuid primary key default gen_random_uuid(),
  techniek text not null,
  soort text not null,
  omschrijving text,
  bedrag numeric not null default 0,
  eenheid text
);
alter table public.decoratie_tarieven enable row level security;
alter table public.decoratie_formaten enable row level security;
alter table public.decoratie_kosten enable row level security;

-- 2. Afwijkende staffels per klant. Heeft een klant voor een techniek en formaat
--    eigen regels, dan gelden die in plaats van de centrale staffel. Alleen KMS.
create table if not exists public.klant_decoratie_tarieven (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  techniek text not null check (length(trim(techniek)) between 1 and 40),
  formaat text not null check (length(trim(formaat)) between 1 and 20),
  vanaf_aantal integer not null default 1 check (vanaf_aantal >= 1),
  stukprijs numeric(10,2) not null check (stukprijs >= 0),
  bijgewerkt_op timestamptz not null default now(),
  unique (organisatie_id, techniek, formaat, vanaf_aantal)
);
alter table public.klant_decoratie_tarieven enable row level security;
revoke all on public.klant_decoratie_tarieven from anon, authenticated;

-- 3. Regels: kleding of personalisatie, en of de prijs met de hand is aangepast
--    (dan blijft hij staan bij herberekenen). decoratie_sleutel koppelt een
--    personalisatieregel aan logo, plek, techniek en formaat.
alter table public.offerteregels add column if not exists soort text not null default 'kleding';
alter table public.offerteregels add column if not exists handmatig boolean not null default false;
alter table public.offerteregels add column if not exists decoratie_sleutel text;
alter table public.orderregels add column if not exists soort text not null default 'kleding';
alter table public.orderregels add column if not exists handmatig boolean not null default false;
alter table public.orderregels add column if not exists decoratie_sleutel text;
alter table public.factuurregels add column if not exists soort text not null default 'kleding';
alter table public.factuurregels add column if not exists decoratie_sleutel text;

do $$
declare t text;
begin
  foreach t in array array['offerteregels', 'orderregels', 'factuurregels'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_soort_check') then
      execute format('alter table public.%I add constraint %I check (soort in (''kleding'', ''personalisatie''))', t, t || '_soort_check');
    end if;
  end loop;
end $$;
