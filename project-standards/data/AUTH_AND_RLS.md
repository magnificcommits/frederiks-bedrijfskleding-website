# AUTH & RLS

Voor Tier 2+ projecten die gebruikersdata opslaan.

## Authenticatie
- Auth via Supabase Auth of gelijkwaardig, nooit zelfgebouwd zonder reden.
- MFA waar mogelijk, verplicht voor admin.
- Veilige sessies: HttpOnly, Secure, SameSite cookies.
- Password reset, magic links en OAuth-flows getest op misbruik (enumeration, replay).
- Logout maakt sessie en refresh token ongeldig.

## Autorisatie (de echte risicozone)
- Elke server action en API-route checkt server-side: is deze gebruiker geauthenticeerd én geautoriseerd voor deze actie op dít object?
- Vertrouw nooit de UI of client-input voor autorisatie.
- IDOR-test: kan gebruiker A met een ander ID data van B lezen of muteren? Mag nooit.
- Admin-functionaliteit achter expliciete role check.

## Row Level Security (Supabase)
- RLS staat aan op álle tabellen met gebruikers-, klant- of persoonsdata. Geen uitzonderingen.
- Policies gebruiken `auth.uid()` voor eigenaarschap.
- Let op `security definer` functies: die omzeilen RLS. Controleer expliciet.
- Storage bucket policies apart instellen, ze omzeilen tabel-RLS.
- `service_role` key uitsluitend server-side, nooit in client of NEXT_PUBLIC.

## Identity & secrets (hardening)
- **MFA verplicht op admin-/beheeraccounts** (en aangeboden aan eindgebruikers waar zinvol).
- **Least privilege:** elk account en elke key heeft de minimale rechten; geen gedeelde superuser.
- **Rolscheiding:** admin ≠ dagelijks account; geen productie-toegang "voor het gemak".
- **Secrets in een vault/secret-manager of platform-env** (Vercel/Supabase), niet in code of `.env` in git.
- **Rotatiebeleid:** vaste cadans + directe rotatie bij elk vermoeden van blootstelling. Niet committen alléén is niet genoeg.
- Aparte secrets per omgeving (dev/preview/prod).

## Threat modeling — STRIDE (kort, per significante feature)
Loop bij een nieuwe feature de zes categorieën langs en noteer dreiging + maatregel:
- **S**poofing → authenticatie · **T**ampering → integriteit · **R**epudiation → logging/audit-trail
- **I**nformation disclosure → autorisatie/encryptie · **D**enial of service → rate-limit/quota · **E**levation of privilege → RBAC/RLS

Proportioneel: één korte ronde voorkomt de meeste ontwerpfouten. Voor het volledige proces zie SECURITY_AUDITOR.

## Testen vóór live
- [ ] RLS aan op alle data-tabellen
- [ ] IDOR-test gedaan en geslaagd
- [ ] Autorisatie server-side op elke mutatie
- [ ] `security definer` functies en storage policies gecontroleerd
- [ ] Admin-routes role-protected
- [ ] MFA op admin; least privilege; rolscheiding
- [ ] Secrets in vault/env met rotatiebeleid
- [ ] STRIDE-ronde gedaan op de kernarchitectuur
