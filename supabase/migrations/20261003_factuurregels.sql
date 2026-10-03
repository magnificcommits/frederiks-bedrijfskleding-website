-- Factuurregels: artikel, kleur, maat, regelkorting en een vaste volgorde.
-- Alleen toevoegingen, idempotent. De code werkt ook zonder deze migratie
-- (korting gaat dan in de stukprijs, volgorde is dan willekeurig), maar pas
-- hierna onthoudt een regel welk artikel/kleur/maat het is en staan de regels
-- in de volgorde waarin ze zijn toegevoegd.
alter table public.factuurregels
  add column if not exists korting_pct numeric not null default 0,
  add column if not exists product_id uuid references public.producten(id) on delete set null,
  add column if not exists kleur text,
  add column if not exists maat text,
  add column if not exists positie int,
  add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table public.factuurregels add constraint factuurregels_korting_pct_chk check (korting_pct >= 0 and korting_pct <= 100);
exception when duplicate_object then null; end $$;

create index if not exists factuurregels_factuur_id_idx on public.factuurregels (factuur_id);
