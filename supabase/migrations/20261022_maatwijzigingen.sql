-- Werkdocument portaal Jessi (21 okt 2026), punt 2: "Maatwijziging aanvragen".
-- Een werknemer vraagt een andere maat aan; Jessi beoordeelt het in het KMS en
-- past dan pas de geregistreerde maat (medewerker_maten) aan.
create table if not exists public.maatwijzigingen (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid not null references public.organisaties(id) on delete cascade,
  medewerker_id uuid not null references public.medewerkers(id) on delete cascade,
  product_id uuid not null references public.producten(id) on delete cascade,
  huidige_maat text,
  gewenste_maat text not null check (length(trim(gewenste_maat)) between 1 and 20),
  toelichting text check (toelichting is null or length(toelichting) <= 500),
  status text not null default 'wacht' check (status in ('wacht', 'goedgekeurd', 'afgewezen')),
  aangevraagd_door text,
  behandeld_door text,
  behandeld_op timestamptz,
  notitie text,
  created_at timestamptz not null default now()
);
create index if not exists maatwijzigingen_status_idx on public.maatwijzigingen (status, created_at desc);
create index if not exists maatwijzigingen_medewerker_idx on public.maatwijzigingen (medewerker_id);
alter table public.maatwijzigingen enable row level security;

-- Portaal: een werknemer ziet en vraagt alleen voor zichzelf; beheerder en
-- leidinggevende zien en vragen voor de hele eigen organisatie. Beoordelen
-- (status wijzigen) kan alleen het KMS op de server.
create policy maatwijzigingen_sel on public.maatwijzigingen
  for select to authenticated
  using (
    organisatie_id = private.current_org()
    and (medewerker_id = private.current_medewerker_id()
         or private.current_rol() = any (array['beheerder', 'leidinggevende']))
  );
create policy maatwijzigingen_ins on public.maatwijzigingen
  for insert to authenticated
  with check (
    organisatie_id = private.current_org()
    and status = 'wacht'
    and behandeld_door is null and behandeld_op is null
    and exists (select 1 from public.medewerkers m where m.id = medewerker_id and m.organisatie_id = private.current_org())
    and (medewerker_id = private.current_medewerker_id()
         or private.current_rol() = any (array['beheerder', 'leidinggevende']))
  );
revoke update, delete on public.maatwijzigingen from anon, authenticated;
revoke select, insert on public.maatwijzigingen from anon;
