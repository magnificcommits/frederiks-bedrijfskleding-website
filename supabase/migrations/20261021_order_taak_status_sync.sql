-- Werkdocument Jessi (21 okt 2026), punt 3.1: orderstatus en taakstatus zijn
-- dezelfde en lopen twee kanten op mee.
--
-- 1. Taakstatussen met precies de namen van de orderstatussen (sleutel order_*).
--    "Nog bestellen" en "Afgerond" bestonden al en worden hergebruikt.
insert into public.taak_statussen (naam, kleur, groep, volgorde, actief, is_afgerond, sleutel)
select v.naam, v.kleur, v.groep, v.volgorde, true, false, v.sleutel
from (values
  ('Offerte verstuurd',       'paars',  'wacht', 30, 'order_offerte_verstuurd'),
  ('Offerte goedgekeurd',     'oranje', 'bezig', 31, 'order_offerte_goedgekeurd'),
  ('Besteld bij leverancier', 'bruin',  'wacht', 32, 'order_besteld'),
  ('Deels binnen',            'bruin',  'wacht', 33, 'order_deellevering'),
  ('Alles binnen',            'geel',   'bezig', 34, 'order_compleet_geleverd'),
  ('Bedrukken',               'geel',   'bezig', 35, 'order_bedrukken'),
  ('Borduren',                'roze',   'wacht', 36, 'order_borduren'),
  ('Verpakken',               'geel',   'bezig', 37, 'order_verpakken'),
  ('Bezorgen',                'geel',   'bezig', 38, 'order_bezorgen'),
  ('Verzonden',               'paars',  'wacht', 39, 'order_verzonden'),
  ('Factureren',              'blauw',  'bezig', 40, 'order_factureren')
) as v(naam, kleur, groep, volgorde, sleutel)
where not exists (select 1 from public.taak_statussen t where t.sleutel = v.sleutel or t.naam = v.naam);

-- Afgerond blijft de laatste stap in de lijst.
update public.taak_statussen set volgorde = 50 where sleutel = 'afgerond' and volgorde < 50;

-- 2. Welke taakstatus (sleutel) hoort bij een orderstatus. Niet via de API bereikbaar.
create or replace function private.order_taak_sleutel(p_status text)
returns text language sql immutable set search_path = '' as $$
  select case p_status
    when 'concept' then 'niet_gestart'
    when 'offerte_verstuurd' then 'order_offerte_verstuurd'
    when 'offerte_goedgekeurd' then 'order_offerte_goedgekeurd'
    when 'nog_bestellen' then 'nog_bestellen'
    when 'besteld' then 'order_besteld'
    when 'deellevering' then 'order_deellevering'
    when 'compleet_geleverd' then 'order_compleet_geleverd'
    when 'bedrukken' then 'order_bedrukken'
    when 'borduren' then 'order_borduren'
    when 'verpakken' then 'order_verpakken'
    when 'bezorgen' then 'order_bezorgen'
    when 'verzonden' then 'order_verzonden'
    when 'factureren' then 'order_factureren'
    when 'afgerond' then 'afgerond'
    when 'geannuleerd' then 'afgerond'
    else null end
$$;

-- 3. Na elke statuswissel van een order de bijbehorende taak bijwerken, waar de
--    wissel ook vandaan komt (orderscherm, inkoop, drukproef, portaal).
--    Security definer: ook een wissel vanuit het portaal (ingelogde klant) moet
--    de taak kunnen bijwerken, terwijl de klant zelf geen taken mag zien.
create or replace function private.sync_taak_bij_orderstatus()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_naam text;
  v_klaar boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  select s.naam, coalesce(s.is_afgerond, false) or s.groep = 'klaar'
    into v_naam, v_klaar
    from public.taak_statussen s
   where s.sleutel = private.order_taak_sleutel(new.status)
   limit 1;
  if v_naam is null then return new; end if;
  update public.taken t
     set werkstatus = v_naam,
         status = case when v_klaar then 'klaar' else 'open' end,
         afgerond_op = case when v_klaar then coalesce(t.afgerond_op, now()) else null end
   where t.order_id = new.id
     and t.bron = 'order'
     and t.verwijderd_op is null
     and t.werkstatus is distinct from v_naam;
  return new;
end;
$$;
revoke all on function private.sync_taak_bij_orderstatus() from public, anon, authenticated;
revoke all on function private.order_taak_sleutel(text) from public, anon, authenticated;
grant execute on function private.order_taak_sleutel(text) to service_role;

create trigger orders_sync_taak
  after update of status on public.orders
  for each row execute function private.sync_taak_bij_orderstatus();

-- 4. Bestaande ordertaken gelijkzetten met hun order.
update public.taken t
   set werkstatus = s.naam,
       status = case when coalesce(s.is_afgerond, false) or s.groep = 'klaar' then 'klaar' else 'open' end,
       afgerond_op = case when coalesce(s.is_afgerond, false) or s.groep = 'klaar' then coalesce(t.afgerond_op, now()) else null end
  from public.orders o
  join public.taak_statussen s on s.sleutel = private.order_taak_sleutel(o.status)
 where t.order_id = o.id
   and t.bron = 'order'
   and t.verwijderd_op is null
   and t.werkstatus is distinct from s.naam;
