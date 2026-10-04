-- Analyse en Rapportages: statushistorie voor doorlooptijden, plus indexen
-- voor de periodequeries.
--
-- Alleen toevoegen, idempotent. De app werkt ook zonder deze migratie:
-- zonder status_historie tonen de blokken "Doorlooptijd per status",
-- "Offerte verstuurd tot akkoord" en "Order tot geleverd" een uitleg in
-- plaats van cijfers (de code vangt 42P01/PGRST205 af).
--
-- Foreign keys: status_historie krijgt bewust GEEN foreign key. Hij bevat
-- orders én offertes in één tabel (entiteit + entiteit_id), en er komt zo
-- nergens een tweede relatie tussen twee tabellen bij (geen PGRST201).
--
-- De historie begint op het moment dat deze migratie draait; er is geen
-- betrouwbare bron om terug te vullen. Doorlooptijden vullen zich vanaf dan.

create table if not exists public.status_historie (
  id uuid primary key default gen_random_uuid(),
  entiteit text not null,            -- 'order' | 'offerte'
  entiteit_id uuid not null,
  van_status text,                   -- null bij aanmaken
  naar_status text not null,
  moment timestamptz not null default now()
);

create index if not exists status_historie_entiteit_idx on public.status_historie (entiteit, entiteit_id, moment);
create index if not exists status_historie_moment_idx on public.status_historie (moment);

-- Alleen de service role (dashboard) leest en schrijft; geen policies voor anon/authenticated.
alter table public.status_historie enable row level security;

-- Eén triggerfunctie voor beide tabellen; de entiteitnaam komt als argument mee.
create or replace function public.log_status_historie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_historie (entiteit, entiteit_id, van_status, naar_status)
    values (tg_argv[0], new.id, null, coalesce(new.status, 'onbekend'));
  elsif new.status is distinct from old.status then
    insert into public.status_historie (entiteit, entiteit_id, van_status, naar_status)
    values (tg_argv[0], new.id, old.status, coalesce(new.status, 'onbekend'));
  end if;
  return null; -- AFTER-trigger: de rij zelf blijft onaangeroerd
end;
$$;

revoke all on function public.log_status_historie() from public, anon, authenticated;

create or replace trigger orders_status_historie
  after insert or update of status on public.orders
  for each row execute function public.log_status_historie('order');

create or replace trigger offertes_status_historie
  after insert or update of status on public.offertes
  for each row execute function public.log_status_historie('offerte');

-- Indexen voor de periodefilters van Analyse en Rapportages.
create index if not exists facturen_factuurdatum_idx on public.facturen (factuurdatum);
create index if not exists orders_besteldatum_idx on public.orders (besteldatum);
create index if not exists orders_created_at_idx on public.orders (created_at);
create index if not exists orders_medewerker_idx on public.orders (medewerker_id) where medewerker_id is not null;
create index if not exists offertes_created_at_idx on public.offertes (created_at);
create index if not exists retouren_created_at_idx on public.retouren (created_at);
create index if not exists klachten_created_at_idx on public.klachten (created_at);
create index if not exists inkoopregels_created_at_idx on public.inkoopregels (created_at);
create index if not exists budget_mutaties_medewerker_datum_idx on public.budget_mutaties (medewerker_id, datum desc);
create index if not exists product_varianten_op_voorraad_idx on public.product_varianten (id) where voorraad > 0;
