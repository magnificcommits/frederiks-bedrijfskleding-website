-- Prospect-brieven met QR-code, persoonlijke kennismakingspagina en voorbeeldportaal (2 okt 2026).
-- Al toegepast via Supabase MCP. Additief en idempotent.
alter table public.prospecten
  add column if not exists token text,
  add column if not exists adres text,
  add column if not exists postcode text,
  add column if not exists logo_url text,
  add column if not exists huisstijl_kleur text,
  add column if not exists mockup_artikelen jsonb,
  add column if not exists eerste_scan_op timestamptz,
  add column if not exists laatste_scan_op timestamptz,
  add column if not exists aantal_scans int not null default 0,
  add column if not exists brief_verstuurd_op date,
  add column if not exists afgemeld_op timestamptz;
update public.prospecten set token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) where token is null;
alter table public.prospecten alter column token set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
alter table public.prospecten alter column token set not null;
create unique index if not exists prospecten_token_uniek on public.prospecten (token);

create table if not exists public.prospect_bezoeken (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospecten(id) on delete cascade,
  soort text not null check (soort in ('qr','link','portaal','aanvraag')),
  pad text,
  created_at timestamptz not null default now()
);
create index if not exists prospect_bezoeken_prospect on public.prospect_bezoeken (prospect_id, created_at desc);
alter table public.prospect_bezoeken enable row level security;

alter table public.taken add column if not exists prospect_id uuid references public.prospecten(id) on delete cascade;
alter table public.taken drop constraint if exists taken_bron_chk;
alter table public.taken add constraint taken_bron_chk check (bron in ('handmatig','order','portaal','inkoop','offerte','prospect'));
create unique index if not exists taken_uniek_prospect on public.taken (prospect_id) where bron = 'prospect';
