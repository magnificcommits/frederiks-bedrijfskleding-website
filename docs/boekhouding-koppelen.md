# Boekhouding koppelen (Moneybird)

Met deze koppeling hoeft Jessi facturen niet meer met de hand in Moneybird te zetten.
Een definitieve factuur uit het KMS gaat met één klik (of automatisch) naar Moneybird,
inclusief klant, regels en btw. Elke ochtend haalt het KMS op welke facturen in
Moneybird betaald zijn en zet die in het KMS op **Betaald**.

Werk je (ook) met een ander pakket of met een accountant? Op de facturenpagina staat
**Exporteren voor de boekhouding**: een CSV voor Excel en een ZIP met UBL-bestanden
(SI-UBL 2.0) die Exact Online, e-Boekhouden, Snelstart en de meeste accountants inlezen.
Per factuur kan dat ook met de knop **UBL downloaden**. Daarvoor is geen koppeling nodig.

Dit kost ongeveer tien minuten en hoeft maar één keer.

## 1. API-token maken in Moneybird

1. Log in op Moneybird met het account van Tim of Jessi.
2. Ga naar <https://moneybird.com/user/applications/new>
   (of: je naam rechtsboven > **Ontwikkelaars** > **Nieuwe API-token / applicatie**).
3. Kies **Persoonlijk API-token**.
4. Geef het een herkenbare naam, bijvoorbeeld `KMS Frederiks`.
5. Zet deze rechten aan:
   - **Verkoopfacturen** (Verkoop): facturen aanmaken en status lezen; hier vallen ook de contacten onder.
   - **Instellingen**: btw-tarieven en grootboekrekeningen lezen.
   - Zie je ook een los vinkje voor **Contacten**, zet dat dan ook aan.
6. Klik op aanmaken en **kopieer het token meteen**. Moneybird laat het maar één keer zien.
   Bewaar het niet in een mail of document; het gaat alleen in Vercel (stap 3).

## 2. Administratie-ID opzoeken

Open de administratie van Frederiks Bedrijfskleding in Moneybird. In de adresbalk staat:

```
https://moneybird.com/123456789012345678/...
```

Dat lange getal is de administratie-ID.

## 3. Variabelen in Vercel zetten

1. Ga in Vercel naar het project van de website > **Settings** > **Environment Variables**.
2. Voeg toe (Environment: **Production**, en eventueel **Preview**):

   | Naam | Waarde |
   | --- | --- |
   | `MONEYBIRD_API_TOKEN` | het token uit stap 1 |
   | `MONEYBIRD_ADMINISTRATIE_ID` | het getal uit stap 2 |

   Kies bij het token voor **Sensitive**, zodat niemand het later nog kan uitlezen.
3. Controleer dat `CRON_SECRET` er ook staat (die gebruiken de andere geplande taken al).
   Zonder `CRON_SECRET` haalt de ochtendcontrole geen betalingen op.
4. Ga naar **Deployments** en kies bij de laatste productie-deploy **Redeploy**.
   Nieuwe variabelen werken pas na een nieuwe deploy.

## 4. Controleren in het KMS

1. Ga naar **Instellingen > Boekhouding**.
2. Bij "API-token aanwezig" staat nu **Ja** en de administratie-ID staat erbij.
3. Klik op **Verbinding testen**. Je ziet de naam van de administratie als het goed is.
4. Onder **Btw-tarieven** staat welk Moneybird-tarief bij 21%, 9% en 0% hoort.
   Staat er "Geen tarief in Moneybird", zet dat tarief dan in Moneybird aan
   (Instellingen > Btw-tarieven).
5. Kies de **standaard grootboekrekening** voor de omzet (of laat Moneybird kiezen).
6. Kies wat Moneybird met een nieuwe factuur doet:
   - **Definitief maken, niet mailen** (aanbevolen): de klant krijgt de factuur al uit
     het KMS, Moneybird boekt hem en kan een bankbetaling eraan koppelen.
   - **Als concept laten staan**: je maakt hem zelf definitief in Moneybird.
   - **Versturen per e-mail via Moneybird**: Moneybird mailt de factuur ook. Mail dan
     niet ook nog uit het KMS, anders krijgt de klant hem twee keer.
7. Wil je dat elke factuur vanzelf doorgaat zodra hij uit Concept gaat (of naar de klant
   gemaild wordt)? Zet dan **Automatisch doorzetten bij definitief maken** aan.

## Hoe het werkt

- **Klant**: het KMS zoekt de klant in Moneybird op KvK-nummer, dan op e-mailadres, dan op
  bedrijfsnaam. Niet gevonden? Dan maakt het KMS de klant aan. Het Moneybird-nummer wordt
  bij de klant bewaard, zodat dat zoeken maar één keer gebeurt.
- **Factuur**: de regels gaan mee met omschrijving, aantal, prijs excl. btw en btw-tarief.
  Het KMS-factuurnummer (bijvoorbeeld FR-2026-0012) staat in Moneybird bij **Referentie**.
  Moneybird geeft de factuur bij definitief maken zijn eigen volgnummer; zoek in Moneybird
  dus op de referentie.
- **Korting op een regel**: Moneybird kent geen regelkorting. De prijs wordt dan de
  nettoprijs en de omschrijving zegt "incl. x% korting". Het totaal blijft gelijk aan het KMS.
- **Nooit dubbel**: een factuur die al in Moneybird staat, kan niet nog een keer worden
  doorgezet. Wijzig je een factuur na het doorzetten, pas hem dan ook in Moneybird aan;
  het KMS waarschuwt als de totalen niet meer gelijk zijn.
- **Betalingen**: elke ochtend om 05:30 UTC (07:30 in de zomer, 06:30 in de winter) kijkt
  het KMS bij Moneybird welke openstaande facturen betaald zijn. Op de factuurpagina kan
  het ook direct met **Status ophalen**.
- **Fouten**: als doorzetten mislukt staat de reden in gewone taal bij de factuur, met de
  knop **Opnieuw proberen**. Staat automatisch doorzetten aan, dan probeert de
  ochtendcontrole het ook zelf opnieuw. Alle pogingen staan in het logboek op
  Instellingen > Boekhouding.

## Token vervangen of intrekken

Maak in Moneybird een nieuw token (stap 1), zet het in Vercel in plaats van het oude en
redeploy. Trek daarna het oude token in Moneybird in. Vermoed je dat een token is
uitgelekt: trek het direct in, ook als je nog geen nieuw token hebt. Het KMS blijft dan
gewoon werken, alleen doorzetten kan even niet.
