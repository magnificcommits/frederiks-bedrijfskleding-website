-- Beveiligingscontrole 14 okt 2026 (adviseur: 0029 SECURITY DEFINER aanroepbaar door ingelogde gebruikers).
-- De hulpfuncties voor RLS horen niet in de API. Verplaatsen in plaats van DROP:
-- policies verwijzen naar de functie zelf, dus ze blijven werken.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
alter function public.current_org() set schema private;
alter function public.current_rol() set schema private;
alter function public.current_medewerker_id() set schema private;
revoke execute on function private.current_org(), private.current_rol(), private.current_medewerker_id() from public, anon;
grant execute on function private.current_org(), private.current_rol(), private.current_medewerker_id() to authenticated, service_role;
