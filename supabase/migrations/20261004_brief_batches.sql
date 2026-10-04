-- Brieven met QR: verzendingen (batches), ontvangers per verzending en eigen templates (4 okt 2026).
-- Alleen toevoegen, idempotent. De code werkt ook zonder deze migratie (terugval op
-- de ingebouwde templates en de oude flow "Brieven tonen").
--
-- Let op de foreign keys: brief_ontvangers verwijst één keer naar prospecten en één
-- keer naar brief_batches, brief_batches één keer naar brief_templates. Geen dubbele
-- verwijzingen, dus bestaande PostgREST-embeds blijven ondubbelzinnig.

create table if not exists public.brief_templates (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  omschrijving text,
  ontwerp jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.brief_templates enable row level security;

create table if not exists public.brief_batches (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  -- Het briefontwerp van deze verzending (kopie van een template, daarna los te bewerken).
  ontwerp jsonb,
  template_id uuid references public.brief_templates(id) on delete set null,
  status text not null default 'concept',
  geprint_op date,
  verstuurd_op date,
  notitie text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'brief_batches_status_chk') then
    alter table public.brief_batches add constraint brief_batches_status_chk
      check (status in ('concept', 'geprint', 'verstuurd', 'afgerond'));
  end if;
end $$;
create index if not exists brief_batches_created on public.brief_batches (created_at desc);
alter table public.brief_batches enable row level security;

create table if not exists public.brief_ontvangers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.brief_batches(id) on delete cascade,
  prospect_id uuid not null references public.prospecten(id) on delete cascade,
  status text not null default 'klaargezet',
  geprint_op date,
  verstuurd_op date,
  eerste_scan_op timestamptz,
  laatste_scan_op timestamptz,
  aantal_scans int not null default 0,
  gereageerd_op date,
  klant_op date,
  notitie text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'brief_ontvangers_status_chk') then
    alter table public.brief_ontvangers add constraint brief_ontvangers_status_chk
      check (status in ('klaargezet', 'geprint', 'verstuurd', 'retour', 'gescand', 'gereageerd', 'afspraak', 'klant', 'geen_interesse'));
  end if;
end $$;
create unique index if not exists brief_ontvangers_uniek on public.brief_ontvangers (batch_id, prospect_id);
create index if not exists brief_ontvangers_prospect on public.brief_ontvangers (prospect_id);
create index if not exists brief_ontvangers_batch_status on public.brief_ontvangers (batch_id, status);
alter table public.brief_ontvangers enable row level security;

-- Snel de bezoeken per soort tellen voor de funnel.
create index if not exists prospect_bezoeken_soort on public.prospect_bezoeken (soort, created_at desc);
