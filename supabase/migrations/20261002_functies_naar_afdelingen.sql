-- Feedback Jessi 2 okt 2026: functies gaan op in afdelingen bij de klant.
--
-- Per functie komt er een afdeling met dezelfde naam bij dezelfde klant (als die
-- nog niet bestaat). Het kledingpakket van de functie (functie_producten) wordt
-- assortiment voor die afdeling. Werknemers met een functie (medewerker_functies)
-- krijgen die afdeling, als ze nog geen afdeling hebben.
--
-- Additief en idempotent: er wordt niets verwijderd en opnieuw draaien maakt
-- geen dubbele rijen. Ontbreekt een van de functietabellen, dan slaat dat deel
-- zichzelf over.

do $$
begin
  if to_regclass('public.functies') is null then
    raise notice 'Tabel functies bestaat niet; niets te doen.';
    return;
  end if;

  -- 1. Afdeling per functie (zelfde naam, zelfde klant), als die nog niet bestaat.
  insert into public.afdelingen (organisatie_id, naam)
  select distinct on (f.organisatie_id, lower(trim(f.naam))) f.organisatie_id, trim(f.naam)
  from public.functies f
  where f.organisatie_id is not null
    and coalesce(trim(f.naam), '') <> ''
    and not exists (
      select 1 from public.afdelingen a
      where a.organisatie_id = f.organisatie_id
        and lower(trim(a.naam)) = lower(trim(f.naam))
    )
  order by f.organisatie_id, lower(trim(f.naam));

  -- 2. Kledingpakket van de functie wordt assortiment voor die afdeling.
  --    functie_producten: (id, functie_id, product_id, aantal, created_at).
  if to_regclass('public.functie_producten') is not null then
    insert into public.assortiment (organisatie_id, product_id, afdeling_id, toegestaan, verstrekking_type, periode)
    select distinct f.organisatie_id, fp.product_id, afd.id, true, 'budget', 'jaar'
    from public.functie_producten fp
    join public.functies f on f.id = fp.functie_id
    join lateral (
      select a.id from public.afdelingen a
      where a.organisatie_id = f.organisatie_id
        and lower(trim(a.naam)) = lower(trim(f.naam))
      order by a.created_at, a.id
      limit 1
    ) afd on true
    where fp.product_id is not null
      and f.organisatie_id is not null
      and not exists (
        select 1 from public.assortiment s
        where s.organisatie_id = f.organisatie_id
          and s.product_id = fp.product_id
          and s.afdeling_id = afd.id
          and s.medewerker_id is null
      );
  end if;

  -- 3. Werknemers met een functie krijgen de bijbehorende afdeling, als ze nog
  --    geen afdeling hebben. Bij meerdere functies telt de eerste op naam.
  --    medewerker_functies: (medewerker_id, functie_id).
  if to_regclass('public.medewerker_functies') is not null then
    update public.medewerkers m
    set afdeling_id = keuze.afdeling_id
    from (
      select distinct on (mf.medewerker_id) mf.medewerker_id, afd.id as afdeling_id
      from public.medewerker_functies mf
      join public.functies f on f.id = mf.functie_id
      join public.medewerkers mw on mw.id = mf.medewerker_id
      join lateral (
        select a.id from public.afdelingen a
        where a.organisatie_id = f.organisatie_id
          and lower(trim(a.naam)) = lower(trim(f.naam))
        order by a.created_at, a.id
        limit 1
      ) afd on true
      where mw.organisatie_id = f.organisatie_id
      order by mf.medewerker_id, lower(trim(f.naam))
    ) keuze
    where m.id = keuze.medewerker_id
      and m.afdeling_id is null;
  end if;
end $$;
