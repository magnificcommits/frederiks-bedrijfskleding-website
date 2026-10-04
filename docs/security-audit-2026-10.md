# Security-audit oktober 2026

KMS (`/dashboard`), klantportaal (`/portaal`) en website. Next.js 15 App Router, Server Actions,
Supabase Postgres met RLS (project `ldbyljadqququzoicyid`), Vercel. Uitgevoerd 4 oktober 2026.

## Samenvatting

Status: **oranje → groen zodra Tim de handmatige blokken draait.**

De basis was al goed: RLS staat op alle 99 tabellen, geen enkele rol kan data van een andere
organisatie lezen of schrijven, alle 348 KMS-exports controleren `dashAuthed()`, er staan geen
geheimen in de repo of de git-geschiedenis. De gaten zaten **binnen** een klant (rol
`medewerker` kon meer dan het portaal liet zien, via de REST-API met zijn eigen sessie), in twee
portaalacties die na een RLS-update ongecontroleerd service-role-werk deden (IDOR), in een
kritieke Next.js-versie en in rate limiting die op Vercel per instantie telde.

| Ernst | Gevonden | Opgelost in code/DB | Handmatig (Tim) | Bewust open |
|---|---|---|---|---|
| Kritiek | 1 | 1 | 0 | 0 |
| Hoog | 2 | 2 | 0 | 0 |
| Middel | 10 | 7 | 3 | 0 |
| Laag | 15 | 8 | 4 | 3 (gedocumenteerd) |

## Bevindingen

### Kritiek

**K1. Next.js 15.5.19 met kritieke kwetsbaarheden (opgelost)**
`npm audit --omit=dev`: GHSA-p293-qw3h-jr36 en GHSA-2xp9-vwfh-vxw4 (kritiek, o.a. DoS via
Server Actions en cache-verwarring van responses), plus 8 hoog/middel (< 15.5.21).
Fix: `next` en `eslint-config-next` naar **15.5.27** (patch binnen 15.5) in `package.json` en
`package-lock.json`; override `nanoid ^3.3.19`. Resultaat `npm audit --omit=dev --package-lock-only`:
kritiek 0 (was 1), hoog 2 (was 3). Vercel installeert de nieuwe versie bij de volgende deploy.
Let op: lokaal is `node_modules` gedeeld en niet bijgewerkt; tsc/lint/build hieronder zijn met
15.5.19 gedraaid. Restant: zie L13.

### Hoog

**H1. IDOR bij goedkeuren van bestellingen in het portaal (opgelost)**
`lib/portaal/goedkeuringen.ts` `beslisOverOrder(orderId)`: de update loopt via RLS en geeft bij
een order-id van een ander bedrijf geen fout maar 0 rijen. Daarna werden **altijd**
`stuurStatusMail(orderId)` en `stuurLeverancierBestelmail(orderId)` (service-role) uitgevoerd.
Aanval: een beheerder/leidinggevende van bedrijf A post `order_id` van bedrijf B naar
`keurGoed` → statusmail naar de besteller van B en een **bestelmail naar de leveranciers** voor
B. Ook kon een al goedgekeurde order opnieuw "goedgekeurd" worden (nogmaals leveranciersmail).
Fix: update met `.eq('goedkeuring_status','wacht').select('id')`; zonder gewijzigde rij geen mails.

**H2. Rol `medewerker` kon drukproeven goedkeuren en wijzigen (opgelost)**
Policy `drukproeven_upd` (rol public, alleen org-check). Het portaal liet drukproeven alleen
aan beheer-rollen zien, maar via de REST-API kon een medewerker met zijn eigen sessie status
en `logo_url` wijzigen, en het `token` lezen om via `/drukproef/<token>` goed te keuren.
Fix: restrictive policies `drukproeven_rol_sel` en `drukproeven_rol_upd` (migratie
`20261006_security_rls_aanscherping.sql`). Bewijs: test T2 (voor `upd_drukproef=1`, na `=0`).

### Middel

**M1. Portaalrechten hingen alleen aan de e-mailclaim in de JWT (opgelost)**
`current_org()/current_rol()/current_medewerker_id()` zochten de `portaal_gebruikers`-rij op
`auth.jwt()->>'email'`. Staat "Confirm email" in Supabase Auth ooit uit, dan kan iemand zich
met het adres van een beheerder aanmelden en krijgt hij diens rechten. Fix: de functies eisen
nu dat `auth.uid()` hoort bij een `auth.users`-rij met datzelfde adres en `email_confirmed_at`.
Bewijs: test T3 (`VALS org= rol=` leeg, 0 rijen).

**M2. Medewerker las de facturen van zijn werkgever (opgelost)** — `facturen_sel`/
`factuurregels_sel` hadden alleen een org-check. Restrictive policy op beheer-rollen. T2.

**M3. Interne CRM-gegevens leesbaar voor de klant (opgelost)** — `klant_activiteiten`
(notities van Frederiks over de klant) en `contactpersonen` waren leesbaar voor iedere
portaalgebruiker. Het portaal gebruikt ze niet. `klant_activiteiten`: nooit; `contactpersonen`:
alleen beheer-rollen.

**M4. AVG: medewerker zag huisadres, telefoon en e-mail van alle collega's (opgelost)** —
`medewerkers_select` en `gebruikers_sel` hadden alleen een org-check. Nu ziet een medewerker
alleen zichzelf (beheer-rollen iedereen van de eigen organisatie). Uitzondering: een gebruiker
zónder medewerker-koppeling ziet de collega's nog, omdat de webshop hem een collega laat kiezen.

**M5. Interne notities op organisatie en order leesbaar voor de klant (HANDMATIG, blok C)** —
`organisaties.interne_notities`, `organisaties.opmerkingen`, `organisaties.moneybird_contact_id`
en `orders.interne_notitie` zitten in rijen die de klant mag lezen. RLS werkt per rij; dit vraagt
kolomrechten (`revoke` + `grant select (kolommen)`). Nu leeg voor de testklant, maar het lek is er.

**M6. Bestandslijst van bucket `media` openbaar (HANDMATIG, blok A)** — policy
`media_public_read` (rol public, SELECT) laat iedereen met de anon-key alle bestanden opsommen
(logo's, drukproeven, reparatiefoto's van alle klanten). Downloaden via de publieke URL heeft
de policy niet nodig.

**M7. Rate limiting publieke formulieren telde per serverless-instantie (opgelost)** —
`rateLimit()` is een `Map` in het geheugen; op Vercel heeft elke instantie een eigen teller.
Nieuw: `publiekeLimiet()` in `lib/ratelimit.ts` telt daarnaast in `login_pogingen` (gehashte
sleutel `form:<soort>:ip:<ip>`, geen leesbaar IP). Toegepast op lead, nieuwsbrief, ontwerp-mail,
retourlink-aanvraag en pasdag-aanvraag (5 per 10 min per IP). Honeypots waren er al op alle vijf.

**M8. Ontwerp-mail: bijlagen en link onder controle van de bezoeker (opgelost)** —
`/api/ontwerp-mail` mailt naar een adres dat de bezoeker zelf invult. (a) De bestandsnaam van de
logo-bijlage was vrij (`factuur.html` met een "afbeelding" erin, verstuurd vanaf ons domein);
(b) SVG mocht mee; (c) de hervat-link werd gecontroleerd met `startsWith(site.url)`, wat ook
`https://<onze-site>.evil.nl` doorliet (phishinglink in een mail van Frederiks). Fix:
`lib/bijlagen.ts` (`logoBijlage`: alleen png/jpg/webp/gif, extensie volgt het type, naam
opgeschoond; `eigenSiteUrl`: vergelijkt de origin). Ook in `/api/lead`.
Restrisico: het endpoint blijft een manier om een (beperkte) mail van Frederiks naar een
willekeurig adres te sturen; nu begrensd op 5 per 10 min per IP. Advies: Cloudflare Turnstile.

**M9. KMS-rol `lezer` kon alles wijzigen (opgelost)** — de rol bestond alleen in de UI. Nu
weigert `dashAuthed()` centraal elke Server Action (header `Next-Action`) voor een lezer.
Restrisico: route handlers met POST (`/dashboard/drukproeven/upload`) vallen hier buiten. Er zijn
op dit moment geen lezers (alleen 2 eigenaren).

**M10. Brute force op de 6-cijferige portaalcode (HANDMATIG, instellingen)** — de portaal-
loginpagina controleert de code in de browser rechtstreeks bij Supabase (`verifyOtp`). Een
app-limiter helpt daar niet: een aanvaller praat direct met de Supabase-API. De echte
bescherming is de Auth-rate-limit "Token verifications" en een korte OTP-verlooptijd. KMS-code
en 2FA hebben daarnaast al een eigen limiet (5 per e-mail / 10 per IP per 15 min).

### Laag

| # | Bevinding | Status |
|---|---|---|
| L1 | Cron-secret en afmeldtoken met `!==`/`===` vergeleken (timing) | opgelost: `veiligGelijk()` in 3 crons en `/afmelden` |
| L2 | HMAC-sleutel afmeldlinks viel zonder `CRON_SECRET` terug op vaste tekst uit de broncode | opgelost: eerst service key |
| L3 | Uploads naar `media`: content-type van de browser overgenomen, geen grootte- of extensiegrens | opgelost in `lib/kms/storage.ts` (max 25 MB, html/js/exe geweigerd, type alleen voor beeld/PDF); bucketgrens: handmatig blok B |
| L4 | Open redirect via `terug` in `zetProspectStatusActie` (achter login) | opgelost |
| L5 | `/api/nieuwsbrief` zonder Zod en zonder maximale lengtes | opgelost |
| L6 | `meldKlacht` nam `order_id` ongecontroleerd over; webshop nam vrij `medewerker_id` uit formulier | opgelost: alleen ids die RLS laat zien |
| L7 | 12 policies op rol `public` i.p.v. `authenticated` (anon ziet toch 0 rijen, getest) | handmatig blok D |
| L8 | anon kan `volgend_retournummer()` en `decoratie_stukprijs()` aanroepen | handmatig blok E |
| L9 | Leaked password protection uit (advisor) | handmatig (dashboard) |
| L10 | CSP met `'unsafe-inline'` in script-src | bewust open, zie Headers |
| L11 | SSRF-guard `/dashboard/producten/fotocontrole/beeld`: DNS-rebinding tussen lookup en fetch mogelijk (alleen voor ingelogde beheerders) | bewust open |
| L12 | Retourtoken: twee keer tegelijk indienen kan twee retouren maken (geen atomische claim) | bewust open |
| L13 | Na de update resteren `postcss` 8.4.31 (vastgepind door Next, alleen bij build) en `sharp` 0.34.5 (libvips-CVE's). Next 15.5.27 accepteert `sharp ^0.35.4`; dat is een minor-sprong, dus niet automatisch gedaan | advies: `sharp` naar 0.35.4+ in een aparte deploy |
| L14 | Lengtes op token-acties (`/retour`, `/drukproef`) onbegrensd | opgelost (`slice`) |
| L15 | Geen bewaartermijnen voor logtabellen (AVG) | opgelost, zie AVG |

Niet-security, wel gezien: `markeerMeldingenGelezen()` werkt niet, omdat `portaal_meldingen`
geen update-policy heeft (RLS weigert stil). Functioneel punt voor de portaal-eigenaar.

## Wat is gecontroleerd en in orde

- **RLS**: 99/99 tabellen in `public` hebben RLS aan; 67 zonder policies (alleen service-role).
  Views `producten_overzicht` en `variant_waarden` hebben `security_invoker=true` en geen grant
  voor anon/authenticated.
- **Functies**: alle `security definer`-functies hebben `search_path=public`; geen enkele is
  door anon uitvoerbaar (`herbereken_variantprijzen`, `normaliseer_categorieen`, triggers: ook
  niet door authenticated). `zet_mijn_portaal_taal` wijzigt alleen de eigen rij.
- **Server Actions/API**: `scripts/check-auth.mjs` vindt 417 exports, 0 zonder herkenbare check
  (zie bijlage). Elke `eisEigenaar()` staat achter `dashAuthed()` (het script markeert dat
  apart, want `magEigenaar()` laat een wachtwoord-login zonder account door).
- **CSRF**: geen `serverActions.allowedOrigins` in `next.config.mjs`, dus de standaard
  origin-check van Next geldt. Formulier-POSTs naar route handlers zijn JSON of token-gebonden.
- **Sessies**: `fb_dash` en `fb_admin_sessie` zijn HMAC-ondertekend, `HttpOnly`,
  `Secure` (productie), `SameSite=Lax`, 8 uur (`lib/kms/adminClient.ts`).
- **XSS**: `dangerouslySetInnerHTML` alleen voor eigen CSS en nieuwsbrief-tekst via
  `sanitizeHtml`. Gefuzzt met 15 payloads (onerror, javascript:/entity-varianten, style-url,
  svg/script, attribuut-injectie): alle onschadelijk. Mailvoorbeelden staan in
  `<iframe sandbox="">`.
- **Open redirects**: auth-callbacks via `veiligVervolg()`, klik-tracking alleen met geldige
  HMAC, overige `terug`-parameters met vaste prefix.
- **Geheimen**: patroonscan (JWT, Stripe, Resend, Supabase PAT, AWS, private keys, `fb_live_`,
  DB-URL's, GitHub-tokens) op HEAD en de volledige git-geschiedenis: 0 treffers. Geen `.env`
  ooit gecommit (alleen `.env.example` zonder waarden). `.gitignore` dekt `.env*`, `/data/` en
  leveranciersbestanden. `NEXT_PUBLIC_*`: alleen Supabase-URL/anon-key, site-URL, GA-id en
  SSO-vlaggen. Geen `'use client'`-bestand importeert `adminClient`/`portaalAdmin`; build-
  canary: zie Testbewijs T6.
- **Logging**: 5 `console.error`-regels, geen persoonsgegevens (alleen foutmeldingen).

## Headers

`next.config.mjs` zet nu: HSTS (2 jaar, preload), `X-Frame-Options: SAMEORIGIN` +
`frame-ancestors 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, uitgebreide `Permissions-Policy` (camera, microfoon,
locatie, payment, usb, serial, bluetooth, browsing-topics uit), nieuw
`Cross-Origin-Opener-Policy: same-origin-allow-popups` en `upgrade-insecure-requests` in de CSP.

`'unsafe-inline'` in `script-src` blijft. Next.js zet inline bootstrap-scripts in elke pagina;
zonder `'unsafe-inline'` is een nonce per verzoek nodig via middleware, en dan kan geen pagina
meer statisch of uit de cache komen. Voor een SEO-site met honderden branche- en regiopagina's is
dat een slechte ruil. De XSS-bescherming zit in React-escaping, de sanitizer en sandboxed iframes.
Heroverwegen als er ooit gebruikers-HTML buiten de sanitizer om op de site komt.

## AVG: bewaartermijnen

Nieuw: `lib/avg/bewaartermijnen.ts` → `ruimOudeLogsOp()`, dagelijks aangeroepen vanuit
`/api/cron/nieuwsbrief` (06:00 UTC). Resultaat staat in de cron-respons (`opgeschoond`).

| Tabel | Termijn | Reden |
|---|---|---|
| `login_pogingen` | 1 dag | rate limiting, gehashte sleutels |
| `api_log` | 90 dagen | storingsonderzoek klant-API |
| `taak_meldingen_log` | 90 dagen | voorkomt dubbele taakmails |
| `campagne_events` | 12 maanden | campagne-analyse |
| `prospect_bezoeken` | 24 maanden | opvolging prospects |
| `audit_log` | 24 maanden | wie deed wat (verantwoording) |
| `nieuwsbrief_inschrijvingen` | 30 dagen | alleen aanmeldingen die nooit zijn bevestigd (double opt-in) |
| `afspraken` | 24 maanden na de afspraak | contactgegevens van online geboekte afspraken |
| `reviews` | 12 maanden | alleen verzoeken waar nooit een score op kwam |

Bewust niet: `factuur_mail_log` (fiscale bewaarplicht 7 jaar) en `status_historie` (hoort bij de
order). Klant-, order- en leadgegevens zelf vallen hier buiten; daarvoor is een apart
verwijderproces nodig (AVG-verzoek), dat bestaat nog niet als functie.

## Testbewijs

Alle schrijftests in één `do $$ ... raise exception 'RESULTAAT (teruggedraaid): %' $$;`: de
exception draait de hele transactie terug, de uitkomst staat in de foutmelding. Rollen via
`set local role authenticated` + `set_config('request.jwt.claims', '{"email":..., "sub":...}')`.
Testaccounts: beheerder, leidinggevende en medewerker van Bouwbedrijf Wassink; tweede
organisatie: de bestaande "Demo (voorbeeldklant)".

**T1. Lezen andere organisatie (vóór en na de migratie)** — per rol `count(*)` op alle 19
tabellen met `organisatie_id` waar `organisatie_id <> Wassink`, plus `organisaties`, `maten`,
`orderregels` via de ouder, en `leads`, `admin_gebruikers`, `api_sleutels`, `prospecten`.
Uitkomst alle drie de rollen: **0** (baseline als postgres: o.a. 168 contactpersonen, 9
medewerkers, 182 organisaties van anderen).

**T2. Schrijven en rol binnen de organisatie**

| Test | Vóór | Na |
|---|---|---|
| MW: medewerker andere org wijzigen | 0 | 0 |
| MW: medewerker eigen org wijzigen | 0 | 0 |
| MW: order andere org wijzigen | 0 | 0 |
| MW: zichzelf beheerder maken | 0 | 0 |
| MW: portaal_gebruiker / order / klacht in andere org invoegen | geweigerd (42501) | geweigerd |
| MW: orderregel bij order van andere org of van collega | geweigerd (42501) | geweigerd |
| MW: drukproef eigen org goedkeuren + logo_url wijzigen | **1 (lek)** | **0** |
| MW: drukproef naar andere org verplaatsen | geweigerd | geweigerd |
| MW: facturen / factuurregels lezen | **2 / ja** | **0 / 0** |
| MW: medewerkers / portaalgebruikers lezen | **4 / 3** | **1 / 1** (zichzelf) |
| LG: zichzelf beheerder maken | 0 | 0 |
| LG: medewerker naar andere org verplaatsen | geweigerd | geweigerd |
| LG: drukproef goedkeuren; facturen / medewerkers / gebruikers lezen | 1; 2/4/3 | 1; 2/4/3 (ongewijzigd) |
| BH: portaalgebruiker andere org wijzigen | 0 | 0 |
| BH: gebruiker naar andere org / e-mail kapen | geweigerd (trigger "Alleen de rol kan worden gewijzigd") | idem |
| BH: medewerker in andere org invoegen | geweigerd | geweigerd |
| BH: orders andere org wijzigen | 0 | 0 |

**T3. Vervalst account** — JWT met e-mail van de beheerder maar een onbekende `sub`:
`current_org()` en `current_rol()` leeg, 0 medewerkers, 0 orders.

**T4. anon (zonder claims)** — `count(*)` op alle tabellen en views in `public`: 0 rijen
zichtbaar, 10 zonder grant geweigerd. Insert in `leads` en `nieuwsbrief_inschrijvingen`:
geweigerd (42501). `current_org()`, `zet_mijn_portaal_taal()`, `herbereken_variantprijzen()`:
geweigerd (42501). Ook een ingelogd account zonder portaalkoppeling ziet 0 rijen.

**T5. Droogtest migratie** — migratie + T2/T3 in één transactie met afsluitende exception;
daarna gecontroleerd dat er 0 restrictive policies en geen testrij waren. Pas toen toegepast
met `apply_migration` en T1–T4 opnieuw gedraaid.

**T6. Statisch** — `node scripts/check-auth.mjs --strict`: exit 0, 417 exports, 0 zonder
check. tsc, lint en `next build`: zie eindverslag van deze ronde. Build-canary: de build is
gedraaid met `SUPABASE_SERVICE_ROLE_KEY=SRK_CANARY_7f3a`; `grep -r SRK_CANARY .next/static`
moet 0 treffers geven.

## Wat Tim handmatig moet doen

1. `supabase/handmatig/20261006_security.sql` in de SQL-editor, blok voor blok:
   A (bucketlijst dicht, middel), C (kolomrechten interne notities, middel, daarna portaal
   doorklikken), B, D, E, F (laag/optioneel). Elk blok heeft uitleg, controlequery en rollback.
2. Supabase Auth-instellingen (onderaan hetzelfde bestand): Confirm email aan, sign-ups uit,
   token-verificatielimiet laten staan, OTP-verlooptijd 600 s, leaked password protection aan,
   MFA verplicht voor KMS-eigenaren.
3. Volgende deploy: controleren dat Vercel Next 15.5.27 installeert (`npm ls next` in de
   buildlog) en dat `CRON_SECRET` gezet is.
4. Overwegen: Cloudflare Turnstile op lead- en ontwerpformulier; `sharp` naar 0.35.4+.

## Bijlage: auth-inventaris

Opnieuw genereren: `node scripts/check-auth.mjs` (markdown) of `--json`. In CI: `--strict`
(exitcode 1 bij een export zonder herkenbare check). Een bewust publieke export markeer je met
het commentaar `// auth: publiek <reden>` (of `auth: token <reden>`) in de functie.

Samenvatting (417 exports): kms 348 · portaal 39 · token 12 · publiek 8 · cron 5 · api-key 5 ·
**zonder check 0**. Kolom "Rol" = er staat ook een rolcheck in (eigenaar, beheerder,
leidinggevende).

Publiek en token (de exports die bewust zonder login werken):

| Export | Soort | Bescherming |
|---|---|---|
| `POST /api/lead` | publiek | Zod, honeypot, `publiekeLimiet` 5/10 min |
| `POST /api/nieuwsbrief` | publiek | Zod, honeypot, `publiekeLimiet` 5/10 min |
| `POST /api/ontwerp-mail` | publiek | Zod, honeypot, `publiekeLimiet` 5/10 min, bijlage-filter |
| `GET /api/pakket/artikelen` | publiek | alleen publieke catalogusvelden, lengtegrens |
| `GET /dashboard|portaal/manifest.webmanifest` | publiek | statisch |
| `controleerLinkAanvraag` | publiek | rate limit per e-mail en IP |
| `vraagRetourlinkAan` | publiek | honeypot, `publiekeLimiet`, altijd hetzelfde antwoord |
| `GET /api/c/[token]` | token | HMAC over token + doel-url |
| `GET /api/c/[token]/o` | token | open-pixel, onbekend token doet niets |
| `GET/POST /afmelden` | token | HMAC-afmeldtoken, constant-time |
| `GET /api/agenda/[token]`, `/k/[token]`, `/nieuwsbrief/[token]` | token | token-lookup |
| `beslisActie` (drukproef) | token | 122-bit token, alleen status concept/verstuurd |
| `pasdagAanvraagActie`, `afmeldenActie` (kennismaking) | token | tokenvorm + lookup, Zod, honeypot, limiet |
| `meldRetourAan` | token | retourtoken (bestaat, niet verlopen, niet gebruikt) |
| `login` (dashboard) | — | wachtwoord, 5 pogingen/15 min per IP |

### Volledige tabel

| Bestand | Export | Soort | Check | Rol | Opmerking |
|---|---|---|---|---|---|
| app/afmelden/route.ts:59 | GET | route | token |  |  |
| app/afmelden/route.ts:73 | POST | route | token |  |  |
| app/api/agenda/[token]/route.ts:69 | GET | route | token |  |  |
| app/api/assortiment/prijs/route.ts:19 | GET | route | portaal |  |  |
| app/api/c/[token]/o/route.ts:10 | GET | route | token |  | auth: token (registreerOpen zoekt het verzendtoken op; onbekend token = niets). |
| app/api/c/[token]/route.ts:14 | GET | route | token |  | auth: token (doorsturen alleen met geldige HMAC-handtekening over token + doel-url). |
| app/api/cron/campagnes/route.ts:17 | GET | route | cron |  | cron+token |
| app/api/cron/moneybird/route.ts:17 | GET | route | cron |  | cron+token |
| app/api/cron/nieuwsbrief/route.ts:19 | GET | route | cron |  | cron+token |
| app/api/cron/taken/route.ts:45 | GET | route | cron |  | cron+token |
| app/api/cron/taken/route.ts:49 | POST | route | cron |  | cron+token |
| app/api/dashboard/search/route.ts:29 | GET | route | kms |  |  |
| app/api/lead/route.ts:28 | POST | route | publiek |  | auth: publiek (offerteformulier); beschermd met rate limit, honeypot en Zod. |
| app/api/nieuwsbrief/route.ts:21 | POST | route | publiek |  | auth: publiek (nieuwsbriefinschrijving); beschermd met rate limit, honeypot en Zod. |
| app/api/ontwerp-mail/route.ts:30 | POST | route | publiek |  | auth: publiek (zachte leadcapture); beschermd met rate limit, honeypot en Zod. |
| app/api/pakket/artikelen/route.ts:14 | GET | route | publiek |  | auth: publiek (alleen publieke catalogusvelden, zie hierboven). |
| app/api/v1/medewerkers/[personeelsnummer]/route.ts:15 | GET | route | api-key |  |  |
| app/api/v1/medewerkers/[personeelsnummer]/route.ts:25 | PATCH | route | api-key |  |  |
| app/api/v1/medewerkers/[personeelsnummer]/uitdienst/route.ts:16 | POST | route | api-key |  |  |
| app/api/v1/medewerkers/route.ts:14 | GET | route | api-key |  |  |
| app/api/v1/medewerkers/route.ts:42 | POST | route | api-key |  |  |
| app/dashboard/actions.ts:27 | login | action | token |  |  |
| app/dashboard/actions.ts:50 | controleerLinkAanvraag | action | publiek |  | auth: publiek (rate limit vóór het aanvragen van een inloglink; geeft geen gegevens prijs). |
| app/dashboard/actions.ts:63 | logout | action | portaal |  |  |
| app/dashboard/actions.ts:76 | saveLeadEdit | action | kms |  |  |
| app/dashboard/admins/actions.ts:21 | adminToevoegen | action | kms | ja |  |
| app/dashboard/admins/actions.ts:37 | adminActiefZetten | action | kms | ja |  |
| app/dashboard/admins/actions.ts:57 | adminRolWijzigen | action | kms | ja |  |
| app/dashboard/admins/actions.ts:79 | adminTweeStapUitzetten | action | kms | ja |  |
| app/dashboard/ai-assistent/actions.ts:12 | aiStatusActie | action | kms |  |  |
| app/dashboard/ai-assistent/actions.ts:49 | genereerActie | action | kms |  |  |
| app/dashboard/analyse/actions.ts:15 | aiSamenvattingActie | action | kms | ja |  |
| app/dashboard/auth/2fa/actions.ts:12 | bevestigTweeStap | action | kms |  | kms+portaal |
| app/dashboard/auth/callback/route.ts:27 | GET | route | portaal |  | portaal+token |
| app/dashboard/auth/codeActions.ts:14 | verifieerAdminCode | action | portaal |  | portaal+token |
| app/dashboard/beveiliging/actions.ts:39 | startKoppeling | action | kms |  | kms+portaal |
| app/dashboard/beveiliging/actions.ts:62 | bevestigKoppeling | action | kms |  | kms+portaal |
| app/dashboard/beveiliging/actions.ts:83 | ontkoppel | action | kms |  | kms+portaal |
| app/dashboard/campagnes/[id]/actions.ts:22 | bewaarFlowActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:31 | testmailActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:41 | voorbeeldActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:48 | wijzigStatusActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:59 | bewaarInstellingenActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:98 | schrijfInActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:117 | stopOntvangerActie | action | kms | ja |  |
| app/dashboard/campagnes/[id]/actions.ts:129 | gereageerdActie | action | kms | ja |  |
| app/dashboard/campagnes/actions.ts:14 | nieuweCampagneActie | action | kms | ja |  |
| app/dashboard/campagnes/actions.ts:25 | dupliceerCampagneActie | action | kms | ja |  |
| app/dashboard/campagnes/actions.ts:34 | verwijderCampagneActie | action | kms | ja |  |
| app/dashboard/campagnes/actions.ts:45 | pauzeerAllesActie | action | kms | ja |  |
| app/dashboard/campagnes/instellingen/actions.ts:7 | bewaarCampagneInstellingenActie | action | kms | ja |  |
| app/dashboard/drukproeven/actions.ts:60 | zoekArtikelenActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:65 | kleurenActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:102 | bewaarDrukproefActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:215 | kopieerDrukproefActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:244 | verstuurDrukproefActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:298 | markeerVerstuurdActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:319 | keurGoedNamensKlantActie | action | kms |  |  |
| app/dashboard/drukproeven/actions.ts:342 | verwijderDrukproefActie | action | kms |  |  |
| app/dashboard/drukproeven/upload/route.ts:22 | POST | route | kms |  |  |
| app/dashboard/export/route.ts:10 | GET | route | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:48 | zoekArtikelenActie | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:55 | haalKleurenActie | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:61 | voegRegel | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:86 | werkRegel | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:133 | verwijderRegel | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:149 | wijzigStatus | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:169 | zetFactuurEmailActie | action | kms | ja |  |
| app/dashboard/facturen/[id]/actions.ts:192 | mailFactuurKlantActie | action | kms | ja |  |
| app/dashboard/facturen/[id]/ubl/route.ts:9 | GET | route | kms | ja |  |
| app/dashboard/facturen/actions.ts:8 | factuurVanOrder | action | kms | ja |  |
| app/dashboard/facturen/actions.ts:22 | factureerAlleActie | action | kms | ja |  |
| app/dashboard/facturen/actions.ts:36 | legeFactuur | action | kms | ja |  |
| app/dashboard/facturen/actions.ts:50 | zetBoekhouderEmailActie | action | kms | ja |  |
| app/dashboard/facturen/actions.ts:59 | markeerBetaaldActie | action | kms | ja |  |
| app/dashboard/facturen/actions.ts:72 | mailFacturenActie | action | kms | ja |  |
| app/dashboard/facturen/boekhoudActions.ts:14 | naarMoneybirdActie | action | kms | ja |  |
| app/dashboard/facturen/boekhoudActions.ts:28 | statusOphalenActie | action | kms | ja |  |
| app/dashboard/facturen/boekhoudActions.ts:41 | bulkDoorzettenActie | action | kms | ja |  |
| app/dashboard/facturen/export/route.ts:16 | GET | route | kms | ja |  |
| app/dashboard/functies/[id]/actions.ts:12 | voegProductToe | action | kms |  |  |
| app/dashboard/functies/[id]/actions.ts:24 | verwijderProductActie | action | kms |  |  |
| app/dashboard/functies/actions.ts:7 | nieuweFunctie | action | kms |  |  |
| app/dashboard/functies/actions.ts:22 | verwijderFunctieActie | action | kms |  |  |
| app/dashboard/import/actions.ts:18 | medewerkersImport | action | kms | ja |  |
| app/dashboard/import/actions.ts:27 | productenImport | action | kms | ja |  |
| app/dashboard/import/actions.ts:35 | productenLijstImport | action | kms | ja |  |
| app/dashboard/inkoop/actions.ts:38 | markeerInkoop | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:80 | markeerRegelsBesteldActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:95 | bestelBijLeverancierActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:113 | maakInkooporderActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:127 | verstuurInkooporderActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:144 | boekOntvangstActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:162 | boekAllesActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:172 | werkInkooporderActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:185 | annuleerInkooporderActie | action | kms |  |  |
| app/dashboard/inkoop/actions.ts:196 | regelUitOrderActie | action | kms |  |  |
| app/dashboard/instellingen/actions.ts:15 | zetBoekhouderActie | action | kms | ja |  |
| app/dashboard/instellingen/actions.ts:29 | zetRetourActie | action | kms | ja |  |
| app/dashboard/instellingen/actions.ts:44 | zetSpaarActie | action | kms | ja |  |
| app/dashboard/instellingen/boekhouding/actions.ts:12 | testVerbindingActie | action | kms | ja |  |
| app/dashboard/instellingen/boekhouding/actions.ts:34 | opslaanBoekhoudingActie | action | kms | ja |  |
| app/dashboard/instellingen/service/actions.ts:39 | zetRetourbeleidActie | action | kms | ja |  |
| app/dashboard/instellingen/service/actions.ts:63 | zetRetourredenenActie | action | kms | ja |  |
| app/dashboard/instellingen/service/actions.ts:72 | zetKlantTermijnActie | action | kms | ja |  |
| app/dashboard/instellingen/service/actions.ts:89 | zetReparatieInstellingenActie | action | kms | ja |  |
| app/dashboard/instellingen/service/actions.ts:104 | zetKlachtInstellingenActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:46 | kleurNieuwActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:58 | kleurOpslaanActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:73 | kleurVerwijderActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:81 | kleurAliasToevoegenActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:86 | kleurAliasVerwijderActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:93 | reeksNieuwActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:98 | reeksOpslaanActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:108 | reeksVerwijderActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:116 | matenToevoegenActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:122 | maatVerwijderActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:127 | maatAliasToevoegenActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:132 | maatAliasVerwijderActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:139 | eigenschapToevoegenActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:145 | eigenschapVerwijderActie | action | kms | ja |  |
| app/dashboard/instellingen/varianten/actions.ts:167 | omzettenActie | action | kms | ja |  |
| app/dashboard/klachten/actions.ts:48 | nieuweKlacht | action | kms |  |  |
| app/dashboard/klachten/actions.ts:75 | wijzigKlachtStatus | action | kms |  |  |
| app/dashboard/klachten/actions.ts:86 | werkKlachtBijActie | action | kms |  |  |
| app/dashboard/klachten/actions.ts:103 | klachtBericht | action | kms |  |  |
| app/dashboard/klachten/actions.ts:122 | sluitKlachtActie | action | kms |  |  |
| app/dashboard/klachten/actions.ts:145 | ordersVoorKlantActie | action | kms |  |  |
| app/dashboard/klachten/actions.ts:150 | zoekProductenActie | action | kms |  |  |
| app/dashboard/klachten/actions.ts:155 | productenVanOrderActie | action | kms |  |  |
| app/dashboard/klanten/[id]/_koppelingen/actions.ts:27 | maakApiSleutelActie | action | kms | ja |  |
| app/dashboard/klanten/[id]/_koppelingen/actions.ts:51 | trekApiSleutelInActie | action | kms | ja |  |
| app/dashboard/klanten/[id]/_koppelingen/actions.ts:100 | importeerCsvActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:71 | werkOrganisatie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:117 | zetRetourenActiefActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:129 | koppelGebruiker | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:141 | voegItemToe | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:155 | wisselItemActief | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:164 | zetStatus | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:177 | nieuwContact | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:198 | werkContactActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:220 | verwijderContactActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:232 | contactNaarWerknemerActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:258 | nieuweActiviteit | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:273 | verwijderActiviteitActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:281 | nieuwLogoActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:299 | verwijderLogoActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:328 | nieuweWerknemerActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:349 | bulkWerknemersActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:359 | werkWerknemerActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:374 | zetWerknemerActiefActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:398 | slaPasdagOpActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:457 | nieuweAfdelingActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:468 | werkAfdelingActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:495 | verwijderAfdelingKlantActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:514 | haalArtikelenActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:526 | haalKleurenActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:538 | voegAssortimentToeActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:603 | werkAssortimentActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:655 | verwijderAssortimentActie | action | kms |  |  |
| app/dashboard/klanten/[id]/actions.ts:685 | maakInloglinkActie | action | kms | ja |  |
| app/dashboard/klanten/[id]/assortiment/actions.ts:28 | wisselAssortiment | action | kms |  |  |
| app/dashboard/klanten/[id]/assortiment/actions.ts:37 | bewaarVerstrekking | action | kms |  |  |
| app/dashboard/klanten/[id]/structuur/actions.ts:37 | bewaarInstellingen | action | kms |  |  |
| app/dashboard/klanten/[id]/structuur/actions.ts:65 | voegVestigingToe | action | kms |  |  |
| app/dashboard/klanten/[id]/structuur/actions.ts:83 | verwijderVestigingActie | action | kms |  |  |
| app/dashboard/klanten/[id]/structuur/actions.ts:91 | voegAfdelingToe | action | kms |  |  |
| app/dashboard/klanten/[id]/structuur/actions.ts:115 | verwijderAfdelingActie | action | kms |  |  |
| app/dashboard/klanten/[id]/structuur/actions.ts:123 | bewaarManagerScope | action | kms |  |  |
| app/dashboard/klanten/actions.ts:14 | nieuweOrganisatie | action | kms |  |  |
| app/dashboard/klanten/nieuw/actions.ts:60 | slaBedrijfOpActie | action | kms |  |  |
| app/dashboard/klanten/nieuw/actions.ts:144 | slaContactenOpActie | action | kms |  |  |
| app/dashboard/klanten/nieuw/actions.ts:258 | slaAfdelingenOpActie | action | kms |  |  |
| app/dashboard/klanten/nieuw/actions.ts:309 | slaWerknemersOpActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:58 | verplaatsLeadActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:72 | zetStatusActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:86 | werkLeadBijActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:102 | werkContactBijActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:120 | logActiviteitActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:132 | volgendeStapActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:148 | voegSamenActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:157 | koppelKlantActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:174 | nieuweKlantActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:190 | offerteActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:203 | nieuweLeadActie | action | kms |  |  |
| app/dashboard/leads/actions.ts:237 | converteerLead | action | kms |  |  |
| app/dashboard/leads/actions.ts:250 | bulkConverteerLeads | action | kms |  |  |
| app/dashboard/leads/actions.ts:268 | aiOpvolgmailActie | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:60 | nieuweLeverancier | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:70 | bewerkLeverancier | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:84 | bewaarNotities | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:93 | voegContactActie | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:111 | bewerkContactActie | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:128 | verwijderContactActie | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:138 | voegDocumentActie | action | kms |  |  |
| app/dashboard/leveranciers/actions.ts:151 | verwijderDocumentActie | action | kms |  |  |
| app/dashboard/logos/actions.ts:63 | nieuwLogo | action | kms |  |  |
| app/dashboard/logos/actions.ts:121 | verwijderLogoActie | action | kms |  |  |
| app/dashboard/logos/actions.ts:175 | werkLogoActie | action | kms |  |  |
| app/dashboard/logos/actions.ts:227 | voegBestandToeActie | action | kms |  |  |
| app/dashboard/logos/actions.ts:285 | verwijderBestandActie | action | kms |  |  |
| app/dashboard/logos/actions.ts:319 | zetWerkbonStatusActie | action | kms |  |  |
| app/dashboard/manifest.webmanifest/route.ts:6 | GET | route | publiek |  | auth: publiek (statisch web-app-manifest, geen gegevens). |
| app/dashboard/medewerker-verzoeken/actions.ts:17 | keurGoedActie | action | kms |  |  |
| app/dashboard/medewerker-verzoeken/actions.ts:26 | wijsAfActie | action | kms |  |  |
| app/dashboard/navActions.ts:16 | bewaarNavFavorieten | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:57 | slaOntwerpOp | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:92 | slaModuleOp | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:109 | verwijderModule | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:129 | uploadNieuwsbriefAfbeelding | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:157 | zoekProducten | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:204 | slaVerzendgegevensOp | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:243 | hernoemNieuwsbrief | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:260 | telOntvangers | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:266 | stuurTestmail | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:277 | startVersturen | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:298 | verstuurBatch | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:317 | probeerMisluktOpnieuw | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:328 | planNieuwsbriefIn | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:357 | annuleerPlanning | action | kms |  |  |
| app/dashboard/nieuwsbrief/[id]/actions.ts:377 | bewaarAlsTemplate | action | kms |  |  |
| app/dashboard/nieuwsbrief/actions.ts:25 | zetAfgemeldActie | action | kms |  |  |
| app/dashboard/nieuwsbrief/actions.ts:61 | nieuweNieuwsbriefActie | action | kms |  |  |
| app/dashboard/nieuwsbrief/actions.ts:73 | kopieerNieuwsbriefActie | action | kms |  |  |
| app/dashboard/nieuwsbrief/actions.ts:91 | verwijderNieuwsbriefActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:40 | haalArtikelenActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:46 | haalKleurenActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:51 | werkOfferteActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:92 | wijzigStatusActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:103 | verwijderOfferteActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:113 | voegRegelActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:137 | werkRegelActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:171 | verwijderRegelActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:183 | voegPakketActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:194 | maakOrderVanOfferteActie | action | kms |  |  |
| app/dashboard/offertes/[id]/actions.ts:204 | mailOfferteActie | action | kms |  |  |
| app/dashboard/offertes/actions.ts:9 | maakOfferteActie | action | kms |  |  |
| app/dashboard/offertes/actions.ts:34 | haalContactenActie | action | kms |  |  |
| app/dashboard/offertes/actions.ts:48 | maakContactVoorOfferteActie | action | kms |  |  |
| app/dashboard/offertes/actions.ts:82 | bulkOfferteStatusActie | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:53 | haalArtikelen | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:63 | haalVarianten | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:68 | voegRegelToe | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:94 | verwijderRegel | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:110 | zetOrderGegevens | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:141 | wijzigStatus | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:152 | beslisGoedkeuring | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:172 | maakInkoopregels | action | kms |  |  |
| app/dashboard/orders/[id]/actions.ts:182 | zetTrackTrace | action | kms |  |  |
| app/dashboard/orders/[id]/werkbon/actions.ts:25 | voegDecoratieToe | action | kms |  |  |
| app/dashboard/orders/[id]/werkbon/actions.ts:42 | verwijderDecoratieActie | action | kms |  |  |
| app/dashboard/orders/[id]/werkbon/actions.ts:56 | werkWerkbonActie | action | kms |  |  |
| app/dashboard/orders/actions.ts:24 | nieuweOrder | action | kms |  |  |
| app/dashboard/orders/actions.ts:67 | wijzigOrderStatusInline | action | kms |  |  |
| app/dashboard/orders/actions.ts:81 | bulkOrderStatusActie | action | kms |  |  |
| app/dashboard/orders/nieuw/actions.ts:21 | haalKlantPersonenActie | action | kms |  |  |
| app/dashboard/orders/nieuw/actions.ts:56 | contactAlsWerknemerActie | action | kms |  |  |
| app/dashboard/pakketten/[id]/actions.ts:17 | werkPakket | action | kms |  |  |
| app/dashboard/pakketten/[id]/actions.ts:32 | voegProductToe | action | kms |  |  |
| app/dashboard/pakketten/[id]/actions.ts:44 | verwijderProductActie | action | kms |  |  |
| app/dashboard/pakketten/actions.ts:12 | nieuwPakket | action | kms |  |  |
| app/dashboard/passessie/actions.ts:24 | startPassessie | action | kms |  |  |
| app/dashboard/passessie/actions.ts:46 | haalVarianten | action | kms |  |  |
| app/dashboard/passessie/actions.ts:58 | haalCatalogus | action | kms |  |  |
| app/dashboard/passessie/actions.ts:78 | voegRegelToe | action | kms |  |  |
| app/dashboard/passessie/actions.ts:121 | verwijderRegel | action | kms |  |  |
| app/dashboard/passessie/actions.ts:136 | rondAf | action | kms |  |  |
| app/dashboard/passessie/actions.ts:146 | heropen | action | kms |  |  |
| app/dashboard/passessie/actions.ts:159 | maakOrder | action | kms |  |  |
| app/dashboard/passessie/actions.ts:218 | naarKlantWerknemers | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:65 | werkProduct | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:100 | verwijderAfbeelding | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:113 | schakelActief | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:121 | voegVariantToe | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:138 | werkVariant | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:155 | verwijderVariant | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:163 | zetKleurAfbeeldingActie | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:178 | verwijderKleurAfbeeldingActie | action | kms |  |  |
| app/dashboard/producten/[id]/actions.ts:192 | genereerBeschrijvingActie | action | kms |  |  |
| app/dashboard/producten/actions.ts:11 | nieuwProduct | action | kms |  |  |
| app/dashboard/producten/export/route.ts:15 | GET | route | kms |  |  |
| app/dashboard/producten/fotocontrole/actions.ts:6 | bewaarMetingenActie | action | kms |  |  |
| app/dashboard/producten/fotocontrole/beeld/route.ts:61 | GET | route | kms |  |  |
| app/dashboard/prospects/[id]/actions.ts:31 | werkProspectActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:63 | uploadLogoActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:83 | haalLogoVanWebsiteActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:98 | haalLogoVanBronActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:122 | accepteerLogoActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:135 | verwijderLogoActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:147 | zetHuisstijlKleurActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:169 | zetMockupArtikelActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:193 | resetMockupActie | action | kms | ja |  |
| app/dashboard/prospects/[id]/actions.ts:209 | markeerBriefVerstuurdActie | action | kms | ja |  |
| app/dashboard/prospects/actions.ts:14 | importeerCsvActie | action | kms | ja |  |
| app/dashboard/prospects/actions.ts:41 | nieuweProspectActie | action | kms | ja |  |
| app/dashboard/prospects/actions.ts:63 | zetProspectStatusActie | action | kms | ja |  |
| app/dashboard/prospects/actions.ts:76 | werkNotitieActie | action | kms | ja |  |
| app/dashboard/prospects/actions.ts:92 | bulkLogosOphalenActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:63 | markeerBrievenVerstuurdActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:103 | maakBatchActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:132 | voegOntvangersToeActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:151 | verwijderOntvangersActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:165 | hernoemBatchActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:179 | verwijderBatchActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:197 | slaBatchOntwerpOpActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:211 | bewaarTemplateActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:229 | verwijderTemplateActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:296 | zetOntvangerStatusActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:309 | bulkOntvangerStatusActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:326 | markeerGeprintActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:344 | markeerVerstuurdActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:376 | maakOpvolgTaakActie | action | kms | ja |  |
| app/dashboard/prospects/brieven/actions.ts:405 | vulAdresAanActie | action | kms | ja |  |
| app/dashboard/retouren/actions.ts:41 | nieuwRetour | action | kms |  |  |
| app/dashboard/retouren/actions.ts:63 | wijzigRetourStatus | action | kms |  |  |
| app/dashboard/retouren/actions.ts:74 | retourBeslissing | action | kms |  |  |
| app/dashboard/retouren/actions.ts:96 | retourVervangendeOrder | action | kms |  |  |
| app/dashboard/retouren/actions.ts:106 | retourCreditfactuur | action | kms |  |  |
| app/dashboard/retouren/actions.ts:116 | retourTaak | action | kms |  |  |
| app/dashboard/retouren/actions.ts:127 | reparatieStap | action | kms |  |  |
| app/dashboard/retouren/actions.ts:137 | reparatieKosten | action | kms |  |  |
| app/dashboard/retouren/actions.ts:149 | reparatieFactuur | action | kms |  |  |
| app/dashboard/sparen/actions.ts:70 | zetSpaarInstellingenActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:80 | wisselPuntenInActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:100 | zetSparenInstellingenActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:121 | synchroniseerActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:162 | slaRegelOpActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:175 | zetRegelActiefActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:184 | verwijderRegelActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:196 | slaNiveauOpActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:218 | verwijderNiveauActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:230 | slaBeloningOpActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:257 | verwijderBeloningActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:269 | boekHandmatigActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:282 | kenRegelToeActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:293 | registreerAanbrengingActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:310 | vervalAanbrengingActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:318 | mailOverzichtActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:327 | zetKlantkortingActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:348 | nieuweInwisselingActie | action | kms | ja |  |
| app/dashboard/sparen/actions.ts:368 | zetInwisselStatusActie | action | kms | ja |  |
| app/dashboard/taken/actions.ts:71 | werkTaakBijActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:89 | vinkTaakActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:104 | bewaarTaakActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:127 | verwijderTaakActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:139 | herstelTaakActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:148 | archiveerTaakActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:158 | verwijderDefinitiefActie | action | kms |  |  |
| app/dashboard/taken/actions.ts:168 | leegPrullenbakActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:44 | maakPersoonActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:54 | werkPersoonBijActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:68 | verwijderPersoonActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:79 | vernieuwAgendaLinkActie | action | kms |  | kms+token |
| app/dashboard/taken/instellingen/actions.ts:91 | maakStatusActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:101 | hernoemStatusActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:120 | zetStatusKleurActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:131 | zetStatusGroepActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:142 | verschuifStatusActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:152 | zetStatusActiefActie | action | kms |  |  |
| app/dashboard/taken/instellingen/actions.ts:162 | verwijderStatusActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:30 | wijzigVoorraadActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:62 | haalHistorieActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:67 | zetLocatieActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:74 | zetBijhoudenActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:97 | bijbestellenSelectieActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:108 | bijbestellenActie | action | kms |  |  |
| app/dashboard/voorraad/actions.ts:118 | verwerkTellingActie | action | kms |  |  |
| app/drukproef/[token]/actions.ts:13 | beslisActie | action | token |  | auth: token (beslisDrukproefViaToken zoekt het token op; alleen concept/verstuurd). |
| app/k/[token]/route.ts:39 | GET | route | kms |  | kms+token |
| app/k/[token]/route.ts:65 | HEAD | route | token |  |  |
| app/kennismaking/[token]/actions.ts:44 | pasdagAanvraagActie | action | token |  |  |
| app/kennismaking/[token]/actions.ts:173 | afmeldenActie | action | token |  |  |
| app/klantenservice/retourneren/actions.ts:13 | vraagRetourlinkAan | action | publiek |  | auth: publiek (retourlink aanvragen); rate limit, honeypot, altijd hetzelfde antwoord. |
| app/nieuwsbrief/[token]/route.ts:21 | GET | route | token |  |  |
| app/portaal/actions.ts:6 | portaalLogout | action | portaal |  |  |
| app/portaal/actions.ts:12 | markeerMeldingenGelezenActie | action | portaal |  |  |
| app/portaal/auth/bevestig/route.ts:14 | GET | route | portaal |  | portaal+token |
| app/portaal/auth/callback/route.ts:14 | GET | route | portaal |  | portaal+token |
| app/portaal/bestellingen/actions.ts:24 | herbestelActie | action | portaal |  |  |
| app/portaal/drukproeven/actions.ts:12 | beslisDrukproefPortaalActie | action | portaal | ja |  |
| app/portaal/goedkeuringen/actions.ts:14 | keurGoed | action | portaal | ja |  |
| app/portaal/goedkeuringen/actions.ts:22 | wijsAf | action | portaal | ja |  |
| app/portaal/herbestellen/actions.ts:7 | vraagHerbestelling | action | portaal |  |  |
| app/portaal/klachten/actions.ts:6 | vraagKlacht | action | portaal |  |  |
| app/portaal/klachten/actions.ts:24 | reageerKlacht | action | portaal |  |  |
| app/portaal/manifest.webmanifest/route.ts:6 | GET | route | publiek |  | auth: publiek (statisch web-app-manifest, geen gegevens). |
| app/portaal/medewerkers/actions.ts:49 | nieuweMedewerker | action | portaal | ja |  |
| app/portaal/medewerkers/actions.ts:72 | verwijderMedewerkerAction | action | portaal | ja |  |
| app/portaal/medewerkers/actions.ts:90 | bewaarBudget | action | portaal | ja |  |
| app/portaal/medewerkers/actions.ts:98 | bewaarMaten | action | portaal | ja |  |
| app/portaal/medewerkers/actions.ts:111 | geefToegangAction | action | portaal | ja |  |
| app/portaal/medewerkers/actions.ts:123 | wijzigRolAction | action | portaal | ja |  |
| app/portaal/medewerkers/actions.ts:132 | trekToegangInAction | action | portaal | ja |  |
| app/portaal/ontwerpen/actions.ts:18 | maakOntwerpAanvraag | action | portaal | ja |  |
| app/portaal/retouren/actions.ts:32 | vraagRetour | action | portaal |  |  |
| app/portaal/retouren/actions.ts:55 | vraagReparatie | action | portaal |  |  |
| app/portaal/sparen/actions.ts:14 | vraagBeloningAanActie | action | portaal | ja |  |
| app/portaal/team/[id]/actions.ts:36 | zetBudgetInstellingenAction | action | portaal | ja |  |
| app/portaal/team/[id]/actions.ts:60 | zetVoorkeursmaatAction | action | portaal | ja |  |
| app/portaal/team/[id]/actions.ts:71 | verwijderVoorkeursmaatAction | action | portaal | ja |  |
| app/portaal/team/actions.ts:30 | nieuwTeamlid | action | portaal | ja |  |
| app/portaal/team/actions.ts:49 | geefToegangAction | action | portaal | ja |  |
| app/portaal/team/actions.ts:60 | wijzigRolAction | action | portaal | ja |  |
| app/portaal/team/actions.ts:68 | trekToegangInAction | action | portaal | ja |  |
| app/portaal/team/actions.ts:75 | zetBudgetAction | action | portaal | ja |  |
| app/portaal/webshop/actions.ts:40 | plaatsBestelling | action | portaal |  |  |
| app/portaal/webshop/actions.ts:123 | bestelPakketActie | action | portaal |  |  |
| app/portaal/webshop/actions.ts:161 | toggleFavorietActie | action | portaal |  |  |
| app/retour/[token]/actions.ts:6 | meldRetourAan | action | token |  | auth: token (verwerkRetour controleert het retourtoken: bestaat, niet verlopen, niet gebruikt). |
| lib/i18n/portaal/acties.ts:24 | zetTaalActie | action | portaal |  |  |
| lib/i18n/portaal/acties.ts:40 | vulTaalAanActie | action | portaal |  |  |
| lib/kms/filterActies.ts:16 | zoekKlantenVoorFilter | action | kms |  |  |
| lib/kms/filterActies.ts:25 | zoekAanvragersVoorFilter | action | kms |  |  |
| lib/kms/filterActies.ts:32 | zoekOfferteContactenVoorFilter | action | kms |  |  |
| lib/kms/persoonActies.ts:18 | haalKlantPersonenOptiesActie | action | kms |  |  |
| lib/kms/persoonActies.ts:25 | haalInternePersonenActie | action | kms |  |  |
| lib/kms/persoonActies.ts:37 | maakPersoonActie | action | kms |  |  |
