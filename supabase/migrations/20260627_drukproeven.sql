-- Drukproeven: per klant een visuele proef (logo op kledingstuk) die de klant
-- goedkeurt of afkeurt, via een mail-goedkeurlink (token) of via het portaal (RLS).
create table if not exists public.drukproeven (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  product_id uuid references public.producten(id) on delete set null,
  naam text not null,
  type text not null default 'tshirt',
  kleur integer not null default 0,
  techniek text not null default 'borduren',
  positie text not null default 'borst-links',
  logo_url text,
  afbeelding_url text,
  omschrijving text,
  status text not null default 'concept',
  opmerking text,
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  behandeld_op timestamptz,
  created_at timestamptz not null default now()
);

alter table public.drukproeven enable row level security;

-- Portaal (RLS): de klant ziet en beslist alleen drukproeven van de eigen organisatie.
-- De mail-goedkeurroute en het dashboard gebruiken de service-role (bypasst RLS).
create policy drukproeven_sel on public.drukproeven for select using (organisatie_id = current_org());
create policy drukproeven_upd on public.drukproeven for update using (organisatie_id = current_org());
