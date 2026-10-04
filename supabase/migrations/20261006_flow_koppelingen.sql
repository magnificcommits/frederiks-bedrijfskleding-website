-- Koppelingen tussen de kernflows (flowtest oktober 2026).
--
-- 1. orders.offerte_id: uit welke offerte een order is gemaakt. Voorkomt dat
--    "Omzetten naar order" twee keer een order maakt, en laat de factuur het
--    btw-tarief van de offerte overnemen.
-- 2. voorraad_mutaties.order_id: bij welke klantorder een afboeking (soort
--    'verkoop') hoort. Zo wordt de voorraad van een order maar één keer
--    afgeboekt, hoe vaak de status ook heen en weer gaat.
--
-- Alleen toevoegen. Idempotent: mag vaker gedraaid worden.
-- Rollback: alter table public.orders drop column offerte_id;
--           alter table public.voorraad_mutaties drop column order_id;

alter table public.orders
  add column if not exists offerte_id uuid references public.offertes(id) on delete set null;

create index if not exists orders_offerte_id_idx on public.orders (offerte_id) where offerte_id is not null;

comment on column public.orders.offerte_id is
  'De offerte waaruit deze order is gemaakt (Omzetten naar order). NULL bij handmatige en portaalorders.';

alter table public.voorraad_mutaties
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists voorraad_mutaties_order_id_idx on public.voorraad_mutaties (order_id) where order_id is not null;

comment on column public.voorraad_mutaties.order_id is
  'Klantorder waarvoor deze mutatie is geboekt (afboeking bij verzenden). NULL bij telling, ontvangst en correctie.';

-- Bestaande orders die uit een offerte komen herkennen aan de notitie
-- "Aangemaakt uit offerte #123" en alsnog koppelen.
update public.orders o
set offerte_id = f.id
from public.offertes f
where o.offerte_id is null
  and o.organisatie_id = f.organisatie_id
  and o.notitie ~ '^Aangemaakt uit offerte #[0-9]+$'
  and f.offertenummer = substring(o.notitie from '#([0-9]+)$')::int;
