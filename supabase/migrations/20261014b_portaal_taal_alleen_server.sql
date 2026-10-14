-- Pas uitvoeren NA de deploy waarin lib/i18n/portaal/acties.ts de taal via de server opslaat.
-- De taalkeuze loopt dan met de servicesleutel; de API-aanroep is niet meer nodig.
revoke execute on function public.zet_mijn_portaal_taal(text, boolean) from public, anon, authenticated;
grant execute on function public.zet_mijn_portaal_taal(text, boolean) to service_role;
