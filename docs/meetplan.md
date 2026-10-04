# Meetplan publieke website

Laatst bijgewerkt: 4 oktober 2026.

## North star

**Gekwalificeerde aanvragen per maand**: offerteaanvragen, kledingadviesaanvragen en geboekte adviesgesprekken van bedrijven met 10 tot 75 medewerkers. Niet pageviews.

## Funnel

1. Bezoek op een landingspagina (home, `/branches/*`, `/regio/*`, `/voor/*`, product)
2. Klik op een CTA (`cta_klik`, `afspraak_klik`, `telefoon_klik`, `whatsapp_klik`)
3. Formulier gestart (`formulier_gestart`)
4. Aanvraag verstuurd (`generate_lead`) of afspraak geboekt (`afspraak_geboekt`)

In GA4: Explore, Funnel exploration met deze vier stappen. Splits op `page_path` van stap 1 om te zien welke branche- en regiopagina's leads opleveren.

## Toestemming

GA4 laadt alleen als `NEXT_PUBLIC_GA_ID` gezet is (`components/Analytics.tsx`). Consent Mode v2 staat standaard op `denied`. De cookiebanner (`components/ConsentBanner.tsx`) zet `analytics_storage` op `granted` na akkoord.

Events gaan via `track()` in `lib/analytics.ts`. Die stuurt **niets** zolang `localStorage['fb-consent']` niet `granted` is, ook geen cookieloze ping. Wie weigert, wordt dus niet gemeten. Reken daarom op onderschatting in GA4 en vergelijk maandelijks met het aantal leads in het KMS.

## Events

| Event | Wanneer | Parameters | Key event |
|---|---|---|---|
| `cta_klik` | Klik op een element met `data-cta="..."` | `cta`, `plek`, `tekst`, `page_path` | nee |
| `afspraak_klik` | Klik op een link naar `/afspraak` | `plek`, `tekst`, `page_path` | nee |
| `telefoon_klik` | Klik op een `tel:`-link | `plek`, `page_path` | **ja** |
| `whatsapp_klik` | Klik op een `wa.me`-link | `plek`, `page_path` | **ja** |
| `email_klik` | Klik op een `mailto:`-link | `plek`, `page_path` | nee |
| `formulier_gestart` | Eerste focus in een formulier | `formulier`, `page_path` | nee |
| `generate_lead` | Aanvraag succesvol verstuurd | `formulier`, `branche`, `page_path` | **ja** |
| `afspraak_geboekt` | Adviesgesprek bevestigd op `/afspraak` | `branche`, `page_path` | **ja** |

`plek` komt uit het dichtstbijzijnde `data-plek`-attribuut (bijv. `hero`, `header`, `mobiele-balk`, `cta-band`, `branche-zijbalk`). Zo zie je welke knop werkt zonder per knop code te schrijven.

### Hoe het technisch werkt

- `components/AnalyticsEvents.tsx` luistert op documentniveau naar kliks en `focusin`. Telefoon-, WhatsApp-, mail- en afspraaklinks worden overal herkend, ook in componenten van anderen.
- Een CTA meten: zet `data-cta="offerte"` (of `afspraak`, `kledingadvies`, `pakket`) op de link en `data-plek="..."` op een omliggend element.
- Een formulier krijgt een naam via `data-formulier="contact"` op het `<form>`. Zonder dat attribuut valt het terug op `aria-label`. Met `data-niet-meten` wordt het overgeslagen. De nieuwsbrief heet `nieuwsbrief`, het contactformulier `contact`.
- Vanuit eigen code: `track('afspraak_geboekt', { branche })` uit `lib/analytics.ts`, of zonder import:
  `window.dispatchEvent(new CustomEvent('fb:track', { detail: { event: 'afspraak_geboekt', branche } }))`.

### Nog te koppelen

- [ ] **`afspraak_geboekt`**: de AfspraakKiezer op `/afspraak` (eigen team) moet dit event afvuren na een bevestigde boeking.
- [ ] **`generate_lead` in `OfferteAanvraag` en `PakketConfigurator`**: die roepen nu zelf `gtag('event', 'generate_lead')` aan. Graag omzetten naar `track('generate_lead', { formulier: 'offerte' })` zodat ook daar de toestemmingsregel geldt.
- [ ] In GA4 de vier key events markeren (Admin, Events, Mark as key event).
- [ ] Search Console koppelen aan GA4.

## Rapportage (maandelijks, 15 minuten)

1. Aantal leads in het KMS vs. `generate_lead` + `afspraak_geboekt` in GA4.
2. Top 5 landingspagina's op leads (niet op bezoek).
3. Welke `plek` levert de meeste CTA-kliks per sessie op. Een knop die niemand gebruikt mag weg.
4. Afhakers: `formulier_gestart` zonder `generate_lead`. Boven 60% is het formulier te lang of onduidelijk.
