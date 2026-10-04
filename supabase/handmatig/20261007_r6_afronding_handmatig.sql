-- HANDMATIG UITVOEREN (Supabase SQL-editor), na migratie 20261007_r6_afronding.sql.
--
-- Waarom handmatig: dit wijzigt bestaande gegevens (het maakt een datum leeg) en
-- hoort daarom niet in een automatische, alleen-toevoegen migratie.
--
-- Wat het doet: orders die hun geleverd_op kregen toen ze op 'Alles binnen'
-- (compleet_geleverd) kwamen en nog niet verzonden zijn, hebben een te vroege
-- leverdatum. De NPS-mail zou daardoor te snel na de echte levering gaan. Deze
-- update maakt die datum leeg; de trigger zet hem opnieuw zodra de order op
-- verzonden, factureren of afgerond komt. Orders die al de deur uit zijn of
-- geannuleerd zijn blijven ongemoeid. Meerdere keren draaien kan geen kwaad.

begin;

update public.orders
   set geleverd_op = null
 where geleverd_op is not null
   and status not in ('verzonden', 'factureren', 'afgerond', 'geannuleerd')
   and not exists (select 1 from public.reviews r where r.order_id = orders.id);

commit;
