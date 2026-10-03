-- Offerte koppelen aan een echte contactpersoon in plaats van een losse naam.
-- De tekstkolom offertes.contactpersoon blijft bestaan en wordt gevuld met de naam
-- (weergave, afdruk, mail en oudere offertes). De code werkt ook zonder deze kolom:
-- dan wordt alleen de naam opgeslagen.

alter table public.offertes
  add column if not exists contactpersoon_id uuid references public.contactpersonen(id) on delete set null;

create index if not exists offertes_contactpersoon_id_idx on public.offertes (contactpersoon_id);

-- Bestaande offertes met alleen een naam: koppelen als die naam precies één keer
-- voorkomt bij de contactpersonen van dezelfde klant.
update public.offertes o
set contactpersoon_id = c.id
from public.contactpersonen c
where o.contactpersoon_id is null
  and o.organisatie_id is not null
  and o.contactpersoon is not null
  and c.organisatie_id = o.organisatie_id
  and lower(trim(c.naam)) = lower(trim(o.contactpersoon))
  and (
    select count(*) from public.contactpersonen c2
    where c2.organisatie_id = o.organisatie_id
      and lower(trim(c2.naam)) = lower(trim(o.contactpersoon))
  ) = 1;
