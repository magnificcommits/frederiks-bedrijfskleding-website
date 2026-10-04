-- Weblead-inname: herkomst, productregels, logo's en "nog niet gezien".
--
-- Alleen toevoegen, idempotent. De website werkt ook zonder deze migratie:
-- saveLead() probeert eerst met de nieuwe kolommen en valt bij een ontbrekende
-- kolom terug op de oude set (naam, bedrijf, e-mail, bron als tekst ...).
--
-- Privacy: geen IP-adres, geen user-agent, geen fingerprint. bezochte_paden bevat
-- alleen paden zonder querystring (max. 30), referrer alleen de hostnaam.
--
-- Foreign keys: lead_regels -> leads en -> producten, lead_logos -> leads en
-- -> logos. Allemaal nieuwe tabellen met per tabelpaar precies één relatie,
-- dus geen tweede FK tussen hetzelfde paar (PGRST201).

alter table public.leads
  add column if not exists bron_kanaal text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists gclid text,
  add column if not exists referrer text,
  add column if not exists landingspagina text,
  add column if not exists conversiepagina text,
  add column if not exists paginas_bekeken integer,
  add column if not exists bezochte_paden jsonb,
  add column if not exists eerste_bezoek_op timestamptz,
  add column if not exists bezoeken integer,
  add column if not exists gezien_op timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_bron_kanaal_chk') then
    alter table public.leads add constraint leads_bron_kanaal_chk
      check (bron_kanaal is null or bron_kanaal in ('formulier', 'configurator', 'selectie', 'kennismaking', 'telefoon', 'handmatig'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_paginas_bekeken_chk') then
    alter table public.leads add constraint leads_paginas_bekeken_chk
      check (paginas_bekeken is null or paginas_bekeken between 0 and 10000);
  end if;
end $$;

create index if not exists leads_bron_kanaal_idx on public.leads (bron_kanaal) where bron_kanaal is not null;
create index if not exists leads_utm_campaign_idx on public.leads (utm_campaign) where utm_campaign is not null;
create index if not exists leads_created_idx on public.leads (created_at desc);
-- Webleads die nog niemand heeft geopend (melding in het KMS).
create index if not exists leads_ongezien_idx on public.leads (created_at desc)
  where gezien_op is null and bron_kanaal is not null;

-- Gekozen artikelen uit de offerteselectie en de pakketconfigurator.
create table if not exists public.lead_regels (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  product_id uuid references public.producten(id) on delete set null,
  omschrijving text not null,
  kleur text,
  maat text,
  aantal integer,
  opmerking text,
  positie integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_regels_aantal_chk') then
    alter table public.lead_regels add constraint lead_regels_aantal_chk check (aantal is null or aantal between 0 and 100000);
  end if;
end $$;

create index if not exists lead_regels_lead_idx on public.lead_regels (lead_id, positie);
create index if not exists lead_regels_product_idx on public.lead_regels (product_id) where product_id is not null;
alter table public.lead_regels enable row level security;

-- Logo's die bij een webaanvraag zijn geüpload. Zolang de lead nog geen klant
-- is, staat het logo hier (logos.organisatie_id is verplicht). Bij omzetten of
-- koppelen naar een klant komt er een rij in logos en wijst logo_id daarheen.
create table if not exists public.lead_logos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  logo_url text not null,
  logo_naam text,
  bron text,
  logo_id uuid references public.logos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_logos_lead_idx on public.lead_logos (lead_id);
create index if not exists lead_logos_open_idx on public.lead_logos (created_at desc) where logo_id is null;
alter table public.lead_logos enable row level security;

-- Zelfde regime als de andere KMS-tabellen: RLS aan, geen policies, alles via de service role.
