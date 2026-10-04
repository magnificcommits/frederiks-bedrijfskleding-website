-- Taalvoorkeur per portaalgebruiker (klantportaal in NL, EN, DE en PL).
-- De keuze staat ook in de cookie fb_taal; deze kolom zorgt dat de taal op een
-- ander apparaat terugkomt na inloggen. NULL = nog niets gekozen.
--
-- Alleen toevoegen. Idempotent: mag vaker gedraaid worden.
-- Rollback: drop function public.zet_mijn_portaal_taal(text, boolean);
--           alter table public.portaal_gebruikers drop constraint portaal_gebruikers_taal_check;
--           alter table public.portaal_gebruikers drop column taal;

alter table public.portaal_gebruikers
  add column if not exists taal text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portaal_gebruikers_taal_check'
      and conrelid = 'public.portaal_gebruikers'::regclass
  ) then
    alter table public.portaal_gebruikers
      add constraint portaal_gebruikers_taal_check check (taal is null or taal in ('nl', 'en', 'de', 'pl'));
  end if;
end $$;

comment on column public.portaal_gebruikers.taal is
  'Taal van het klantportaal voor deze gebruiker: nl, en, de of pl. NULL = nog niet gekozen.';

-- Er is bewust geen UPDATE-policy voor gebruikers op hun eigen rij: daarmee zou
-- iemand ook zijn eigen rol kunnen wijzigen. Deze functie wijzigt alleen de kolom
-- taal, alleen op de rij van het ingelogde e-mailadres. Lezen gaat via de
-- bestaande policy gebruiker_eigen_rij.
create or replace function public.zet_mijn_portaal_taal(p_taal text, p_alleen_als_leeg boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_email is null or v_email = '' then
    return;
  end if;
  if p_taal is null or p_taal not in ('nl', 'en', 'de', 'pl') then
    raise exception 'Onbekende taal: %', p_taal using errcode = '22023';
  end if;
  update public.portaal_gebruikers
     set taal = p_taal
   where lower(email) = v_email
     and (not p_alleen_als_leeg or taal is null);
end;
$$;

revoke all on function public.zet_mijn_portaal_taal(text, boolean) from public;
revoke all on function public.zet_mijn_portaal_taal(text, boolean) from anon;
grant execute on function public.zet_mijn_portaal_taal(text, boolean) to authenticated;
