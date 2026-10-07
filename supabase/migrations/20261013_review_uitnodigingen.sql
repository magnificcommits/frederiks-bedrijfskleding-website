-- Google-reviewuitnodigingen die Jessi wekelijks accordeert.
-- Elke maandag stelt het systeem klanten voor (recent geleverd, geen lage score,
-- niet recent gevraagd); Jessi kiest wie de mail met de Google-link krijgt.
create table if not exists public.review_uitnodigingen (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week text not null,                         -- ISO-week, bv. 2026-W42
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  email text,
  naam text,
  bedrijf text,
  reden text,                                 -- waarom voorgesteld, voor Jessi
  bron text not null default 'voorstel' check (bron in ('voorstel', 'handmatig')),
  status text not null default 'voorgesteld' check (status in ('voorgesteld', 'verstuurd', 'overgeslagen', 'mislukt')),
  token text unique,
  beslist_op timestamptz,
  verstuurd_op timestamptz,
  geklikt_op timestamptz,
  fout text,
  unique (organisatie_id, week)
);
create index if not exists review_uitnodigingen_status_idx on public.review_uitnodigingen (status, created_at desc);
create index if not exists review_uitnodigingen_org_idx on public.review_uitnodigingen (organisatie_id, created_at desc);
alter table public.review_uitnodigingen enable row level security;
-- Geen policies: alleen via de service-role (kmsAdmin) in het KMS en de klikroute.
