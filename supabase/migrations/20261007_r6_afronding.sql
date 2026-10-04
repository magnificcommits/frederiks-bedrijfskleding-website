-- Ronde 6, afronding. Alleen toevoegen of vervangen, idempotent. Geen drop/delete.
--
-- 1. NPS-mail kwam te vroeg: geleverd_op werd al gezet bij 'compleet_geleverd'
--    (alles binnen bij Frederiks, nog niet bij de klant). Vanaf nu alleen bij
--    statussen waarin de order de deur uit is. De bestaande trigger
--    orders_geleverd_op_trg (20261006_afspraken_reviews_optin.sql) blijft staan
--    en gebruikt automatisch deze nieuwe versie van de functie.

create or replace function public.orders_zet_geleverd_op()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('verzonden', 'factureren', 'afgerond') and new.geleverd_op is null then
    new.geleverd_op := now();
  end if;
  return new;
end;
$$;
