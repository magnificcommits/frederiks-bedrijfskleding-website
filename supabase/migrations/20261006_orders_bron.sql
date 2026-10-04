-- Orderbron: waar een order vandaan komt (klantportaal, handmatig in het KMS, of de open API).
--
-- Tot nu toe werd dit geschat uit aangevraagd_door ("bevat een @ = portaal"). Dat ging mis
-- bij een passessie of handmatige order met het e-mailadres van een beheerder als aanvrager.
-- Vanaf nu zet de code de bron bij het aanmaken; de standaard is 'handmatig'.
--
-- Additief en idempotent. Bestaande orders worden eenmalig afgeleid met dezelfde
-- regel als de oude schatting, behalve orders uit een passessie of offerte (notitie).

alter table public.orders add column if not exists bron text not null default 'handmatig';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_bron_chk') then
    alter table public.orders add constraint orders_bron_chk check (bron in ('handmatig', 'portaal', 'api'));
  end if;
end $$;

comment on column public.orders.bron is
  'Herkomst van de order: portaal (klantportaal/webshop), handmatig (KMS, passessie, offerte) of api (open API). Gezet bij aanmaken.';

-- Eenmalig afleiden voor bestaande orders (alleen rijen die nog op de standaard staan).
update public.orders
set bron = 'portaal'
where bron = 'handmatig'
  and aangevraagd_door like '%@%'
  and coalesce(notitie, '') not ilike 'Uit passessie%'
  and coalesce(notitie, '') not ilike 'Aangemaakt uit offerte%';

create index if not exists orders_bron_idx on public.orders (bron);
