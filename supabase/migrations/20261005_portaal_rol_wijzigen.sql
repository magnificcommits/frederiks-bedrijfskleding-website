-- "Rol wijzigen" in het portaal deed niets: er was geen update-policy op
-- portaal_gebruikers, dus de update raakte stil 0 rijen.
--
-- Een beheerder mag de rol wijzigen van andere logins in zijn eigen bedrijf.
-- Niet die van zichzelf (dan kan een bedrijf zonder beheerder komen te zitten).
-- De trigger zorgt dat een ingelogde portaalgebruiker alleen de kolom rol kan
-- wijzigen (taal loopt via de functie zet_mijn_portaal_taal). Het KMS werkt met
-- de service-role en valt hier niet onder.

create policy gebruikers_upd on public.portaal_gebruikers
  for update to authenticated
  using (
    organisatie_id = current_org()
    and current_rol() = 'beheerder'
    and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    organisatie_id = current_org()
    and rol in ('beheerder', 'leidinggevende', 'medewerker')
  );

create or replace function public.portaal_gebruikers_alleen_rol()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  -- current_user is 'authenticated' bij een directe update vanuit het portaal.
  -- In de security-definer-functie zet_mijn_portaal_taal is het de eigenaar.
  if current_user = 'authenticated'
     and (to_jsonb(new) - 'rol') is distinct from (to_jsonb(old) - 'rol') then
    raise exception 'Alleen de rol kan worden gewijzigd';
  end if;
  return new;
end
$fn$;

create trigger portaal_gebruikers_alleen_rol
  before update on public.portaal_gebruikers
  for each row execute function public.portaal_gebruikers_alleen_rol();
