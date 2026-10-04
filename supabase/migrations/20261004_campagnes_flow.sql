-- Campagnes v2: visuele flow (stappen met splitsingen), triggers, doelen,
-- ontvangers uit prospects, leads en klanten, open-/kliktracking en een tijdlijn.
--
-- Alleen toevoegen, idempotent. De code werkt ook zonder deze migratie (dan in
-- de oude modus: alleen prospects, platte stappen uit campagne_stappen).
--
-- LET OP foreign keys: campagne_inschrijvingen verwijst al naar prospecten en
-- campagnes. De nieuwe kolommen lead_id en organisatie_id krijgen bewust GEEN
-- foreign key. Met een FK naar leads en organisaties zou deze tabel een tweede
-- koppelpad tussen leads en organisaties (en organisaties en prospecten) worden,
-- en dan breken bestaande PostgREST-embeds met PGRST201. Hetzelfde geldt voor
-- campagne_events.campagne_id en de nieuwe kolommen in campagne_verzendingen.

-- 1. Campagnes -----------------------------------------------------------------
alter table public.campagnes add column if not exists flow jsonb;
alter table public.campagnes add column if not exists trigger jsonb not null default '{"soort":"handmatig"}'::jsonb;
alter table public.campagnes add column if not exists doel jsonb not null default '{"soorten":[]}'::jsonb;
alter table public.campagnes add column if not exists doelgroep text not null default 'prospect';
alter table public.campagnes add column if not exists omschrijving text;
alter table public.campagnes add column if not exists voorbeeld text;
alter table public.campagnes add column if not exists geactiveerd_op timestamptz;
alter table public.campagnes add column if not exists updated_at timestamptz not null default now();

-- Bestaande campagnes met platte stappen omzetten naar een flow, zodat ze in de
-- flowbouwer verschijnen. De mailstap houdt het id van de oude stap.
update public.campagnes c
set flow = jsonb_build_object(
  'versie', 1,
  'stappen', coalesce((
    select jsonb_agg(k order by s.volgorde, k_i)
    from public.campagne_stappen s,
    lateral (
      select 0 as k_i, jsonb_build_object('id', 'w-' || s.id::text, 'type', 'wacht', 'modus', 'dagen', 'aantal', s.wacht_dagen, 'weekdag', 1) as k
      where s.wacht_dagen > 0 and s.volgorde > (select min(volgorde) from public.campagne_stappen x where x.campagne_id = c.id)
      union all
      select 1, jsonb_build_object('id', s.id::text, 'type', 'mail', 'onderwerp', s.onderwerp, 'preheader', '', 'inhoud', s.body,
                                   'stijl', 'persoonlijk', 'nieuwsbriefId', null, 'ai', s.ai_personaliseer)
    ) l
    where s.campagne_id = c.id
  ), '[]'::jsonb)
)
where c.flow is null
  and exists (select 1 from public.campagne_stappen s where s.campagne_id = c.id);

-- 2. Inschrijvingen ------------------------------------------------------------
alter table public.campagne_inschrijvingen alter column prospect_id drop not null;
alter table public.campagne_inschrijvingen add column if not exists lead_id uuid;
alter table public.campagne_inschrijvingen add column if not exists organisatie_id uuid;
alter table public.campagne_inschrijvingen add column if not exists email text;
alter table public.campagne_inschrijvingen add column if not exists naam text;
alter table public.campagne_inschrijvingen add column if not exists huidige_knoop text;
alter table public.campagne_inschrijvingen add column if not exists bron text not null default 'handmatig';
alter table public.campagne_inschrijvingen add column if not exists gereageerd_op timestamptz;
alter table public.campagne_inschrijvingen add column if not exists doel_bereikt_op timestamptz;
alter table public.campagne_inschrijvingen add column if not exists afgerond_op timestamptz;
alter table public.campagne_inschrijvingen add column if not exists laatste_actie_op timestamptz;
alter table public.campagne_inschrijvingen add column if not exists fouten integer not null default 0;

-- Eén inschrijving per lead of organisatie per campagne (NULL telt niet mee).
create unique index if not exists campagne_inschrijvingen_campagne_lead_uniek
  on public.campagne_inschrijvingen (campagne_id, lead_id);
create unique index if not exists campagne_inschrijvingen_campagne_org_uniek
  on public.campagne_inschrijvingen (campagne_id, organisatie_id);
create index if not exists campagne_inschrijvingen_wachtrij
  on public.campagne_inschrijvingen (status, volgende_verzending);
create index if not exists campagne_inschrijvingen_email
  on public.campagne_inschrijvingen (lower(email));

-- Een inschrijving moet bij iemand horen.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campagne_inschrijvingen_iemand_chk') then
    alter table public.campagne_inschrijvingen
      add constraint campagne_inschrijvingen_iemand_chk
      check (prospect_id is not null or lead_id is not null or organisatie_id is not null) not valid;
  end if;
end $$;

-- 3. Verzendingen: tracking --------------------------------------------------
alter table public.campagne_verzendingen add column if not exists node_id text;
alter table public.campagne_verzendingen add column if not exists email text;
alter table public.campagne_verzendingen add column if not exists token text;
alter table public.campagne_verzendingen add column if not exists geopend_op timestamptz;
alter table public.campagne_verzendingen add column if not exists geklikt_op timestamptz;
alter table public.campagne_verzendingen add column if not exists aantal_opens integer not null default 0;
alter table public.campagne_verzendingen add column if not exists aantal_kliks integer not null default 0;
alter table public.campagne_verzendingen add column if not exists lead_id uuid;
alter table public.campagne_verzendingen add column if not exists organisatie_id uuid;

create unique index if not exists campagne_verzendingen_token_uniek on public.campagne_verzendingen (token) where token is not null;
create index if not exists campagne_verzendingen_inschrijving on public.campagne_verzendingen (inschrijving_id);
create index if not exists campagne_verzendingen_campagne_datum on public.campagne_verzendingen (campagne_id, verzonden_op);
create index if not exists campagne_verzendingen_email_datum on public.campagne_verzendingen (lower(email), verzonden_op);

-- 4. Tijdlijn per ontvanger --------------------------------------------------
create table if not exists public.campagne_events (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null,
  inschrijving_id uuid references public.campagne_inschrijvingen(id) on delete cascade,
  node_id text,
  soort text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists campagne_events_inschrijving on public.campagne_events (inschrijving_id, created_at);
create index if not exists campagne_events_campagne on public.campagne_events (campagne_id, soort, created_at);
alter table public.campagne_events enable row level security;

-- 5. Tags (op e-mailadres, zodat ze gelden voor prospect, lead en klant) ------
create table if not exists public.campagne_tags (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tag text not null,
  bron_campagne_id uuid,
  created_at timestamptz not null default now()
);
-- De code slaat e-mail en tag altijd in kleine letters op; zo kan upsert op (email, tag).
create unique index if not exists campagne_tags_uniek on public.campagne_tags (email, tag);
alter table public.campagne_tags enable row level security;

-- RLS staat aan zonder policies: alleen de service role (dashboard en cron) kan erbij.
