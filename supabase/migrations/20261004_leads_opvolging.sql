-- Leads: pijplijn, opvolging en tijdlijn.
--
-- Alleen toevoegen, idempotent. De app werkt ook zonder deze migratie:
-- - zonder de nieuwe kolommen worden alleen status, bedrag, notitie en
--   opvolgdatum opgeslagen; score en reactietijd worden dan berekend;
-- - zonder lead_activiteiten komen notities, belletjes en statuswijzigingen
--   in audit_log (entiteit 'lead') en leest de tijdlijn die.
--
-- Statussen blijven tekst zonder check, met dezelfde sleutels als voorheen:
--   nieuw, contact, afspraak, offerte, geaccordeerd (gewonnen), afgewezen (verloren).
-- 'contact' en 'afspraak' zijn nieuw; de bestaande rijen hoeven niet om.
--
-- Foreign keys: leads had er alleen een naar organisaties. De nieuwe FK's gaan
-- naar tabellen waar leads nog geen relatie mee had (taak_personen), of van een
-- tabel die nog niet naar leads verwees (taken, lead_activiteiten). Er komt dus
-- nergens een tweede relatie tussen hetzelfde tabelpaar (geen PGRST201).
-- leads.volgende_taak_id krijgt bewust GEEN FK: taken.lead_id verwijst al naar
-- leads, en een FK de andere kant op maakt een embed leads <-> taken dubbelzinnig.

alter table public.leads
  add column if not exists score smallint,
  add column if not exists kans smallint,
  add column if not exists verloren_reden text,
  add column if not exists eerste_contact timestamptz,
  add column if not exists laatste_contact timestamptz,
  add column if not exists eigenaar_id uuid references public.taak_personen(id) on delete set null,
  add column if not exists eigenaar text,
  add column if not exists volgende_stap text,
  add column if not exists volgende_taak_id uuid,
  add column if not exists status_gewijzigd_op timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_kans_bereik_chk') then
    alter table public.leads add constraint leads_kans_bereik_chk check (kans is null or (kans between 0 and 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_score_bereik_chk') then
    alter table public.leads add constraint leads_score_bereik_chk check (score is null or (score between 0 and 100));
  end if;
end $$;

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_opvolgdatum_idx on public.leads (opvolgdatum) where opvolgdatum is not null;
create index if not exists leads_eigenaar_idx on public.leads (eigenaar_id) where eigenaar_id is not null;
create index if not exists leads_email_lower_idx on public.leads (lower(email));

-- Tijdlijn per lead: notities, belletjes, mails, WhatsApp, reacties van de klant,
-- statuswijzigingen en systeemregels (samengevoegd, klant gekoppeld).
create table if not exists public.lead_activiteiten (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  soort text not null default 'notitie',
  tekst text,
  door text,
  door_persoon_id uuid references public.taak_personen(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_activiteiten_soort_chk') then
    alter table public.lead_activiteiten add constraint lead_activiteiten_soort_chk
      check (soort in ('notitie', 'telefoon', 'mail', 'whatsapp', 'afspraak', 'reactie', 'status', 'taak', 'systeem'));
  end if;
end $$;

create index if not exists lead_activiteiten_lead_idx on public.lead_activiteiten (lead_id, created_at desc);

-- Zelfde regime als de andere KMS-tabellen: RLS aan, geen policies, alles via de service role.
alter table public.lead_activiteiten enable row level security;

-- Taken die uit een lead komen ("volgende stap"). De taak houdt bron 'handmatig',
-- zodat Jessi hem gewoon kan afvinken of verwijderen; lead_id legt de koppeling.
alter table public.taken
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists taken_lead_idx on public.taken (lead_id) where lead_id is not null;
