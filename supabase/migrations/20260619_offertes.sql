-- Offertemodule: offertes met regels (CRM).
create table if not exists offertes (
  id uuid primary key default gen_random_uuid(),
  offertenummer serial,
  organisatie_id uuid references organisaties(id) on delete set null,
  lead_id uuid,
  contactpersoon text,
  status text not null default 'concept',   -- concept | verstuurd | geaccepteerd | afgewezen
  geldig_tot date,
  notitie text,
  btw_pct numeric not null default 21,
  created_at timestamptz not null default now()
);
create table if not exists offerteregels (
  id uuid primary key default gen_random_uuid(),
  offerte_id uuid not null references offertes(id) on delete cascade,
  omschrijving text not null,
  aantal numeric not null default 1,
  stukprijs numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table offertes enable row level security;
alter table offerteregels enable row level security;
create index if not exists idx_offerteregels_offerte on offerteregels (offerte_id);
