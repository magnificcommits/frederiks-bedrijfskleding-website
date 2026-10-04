# Testen en bewaken

Drie lagen, van snel naar breed:

1. **Unit-tests** (`npm test`): rekenregels zonder database of netwerk. Draait in een paar seconden.
2. **Rooktest** (`npm run test:e2e`): opent elke publieke pagina in een echte browser en kijkt of hij heel is.
3. **Uptime-monitor** op `/api/health`: waarschuwt je als de site of de database plat ligt.

---

## 1. Unit-tests

```bash
npm install        # eenmalig
npm test           # alle tests
npm run test:watch # opnieuw bij elke wijziging
```

De tests staan in `tests/unit/`. Wat er onder valt:

| Bestand | Wat |
|---|---|
| `totalen.test.ts` | Btw en totalen van facturen en offertes, regelkorting, vervaldatum |
| `boekhouding.test.ts` | UBL-factuur (SI-UBL 2.0), CSV-export voor de accountant, Moneybird-regels en btw-koppeling (zonder netwerk) |
| `leads.test.ts` | Leadscore, teamgrootte, herkomst, dubbele leads, opvolging |
| `sparen.test.ts` | Spaarpunten, bonussen, terugboeken, verval (oudste eerst), niveaus |
| `varianten.test.ts` | Kleur- en maatnormalisatie, de vaste lijst, normaliseren bij import |
| `api.test.ts` | Validatie van de open API (`/api/v1`), API-sleutels en scopes |
| `i18n.test.ts` | Portaal-woordenboeken compleet in nl/en/de/pl, zelfde `{variabelen}`, Poolse meervouden |
| `datum.test.ts` | Datumfilters, presets, Nederlandse tijdzone, werkdagen en wachtstappen van campagnes |
| `robuustheid.test.ts` | Foutafhandeling (`lib/dbFout.ts`), ophalen voorbij 1000 rijen (`lib/alleRijen.ts`), zoeken in het menu |

Een nieuwe bug gevonden? Schrijf eerst een test die faalt, los hem dan op.

---

## 2. Rooktest (smoke test)

Het script `scripts/e2e-rook.mjs` haalt de sitemap op, opent elke pagina daaruit plus
`/portaal/login`, `/dashboard` (het inlogscherm) en `/api/health`, op telefoonbreedte (390 px), en controleert:

- de pagina geeft status 200 (een doorverwijzing mag, als de eindpagina 200 geeft);
- geen fouten in de browserconsole en geen onafgevangen JavaScript-fouten;
- geen "Application error" (het witte crashscherm van Next.js);
- er is een paginatitel;
- de pagina is niet breder dan het scherm (geen horizontaal scrollen op de telefoon).

### Eenmalig klaarzetten

```bash
npm install
npx playwright install chromium
```

### Tegen productie draaien

```bash
BASE_URL=https://www.frederiksbedrijfskleding.nl npm run test:e2e
```

Op Windows (PowerShell):

```powershell
$env:BASE_URL="https://www.frederiksbedrijfskleding.nl"; npm run test:e2e
```

Handige varianten:

```bash
# Alleen de eerste 30 pagina's uit de sitemap
BASE_URL=https://www.frederiksbedrijfskleding.nl node scripts/e2e-rook.mjs --max=30

# Alleen regiopagina's en branches
BASE_URL=https://www.frederiksbedrijfskleding.nl node scripts/e2e-rook.mjs --alleen=/regio,/branches

# Een preview-deploy van Vercel
BASE_URL=https://<naam>-<hash>.vercel.app npm run test:e2e
```

Uitkomst: per pagina `[ ok ]` of `[FOUT]` met de reden, en onderaan een samenvatting.
Exitcode 0 betekent alles goed, 1 betekent minstens één fout.

Let op: elke run telt als bezoek in de statistieken van Vercel. De browser stuurt "fb-rooktest"
mee in de user-agent, zodat je die bezoeken kunt herkennen. Draai hem dus na een release,
niet elk uur.

### Lokaal tegen een productiebuild

```bash
npm run build
npm start              # in een tweede terminal
npm run test:e2e       # standaard tegen http://localhost:3000
```

---

## 3. Uptime-monitor op `/api/health`

`/api/health` antwoordt:

- **200** met `{"status":"ok"}` als de site draait en de database binnen 5 seconden antwoordt;
- **503** met `{"status":"fout"}` als de database onbereikbaar, te traag of niet ingesteld is.

Er staan bewust geen details in het antwoord (de route is openbaar). De reden staat in de
logboeken van Vercel: Project > **Logs**, zoek op `[health]`.

### UptimeRobot (gratis, controle elke 5 minuten)

1. Maak een account op <https://uptimerobot.com> (gratis plan).
2. **Add New Monitor**:
   - Monitor type: **HTTP(s)**
   - Friendly name: `Frederiks website + database`
   - URL: `https://www.frederiksbedrijfskleding.nl/api/health`
   - Monitoring interval: 5 minuten
3. Bij **Alert contacts**: zet je e-mailadres aan (en eventueel de app voor pushmeldingen).
4. Optioneel: **Advanced settings > Keyword monitoring** met het woord `"ok"`, zodat ook een
   lege of vreemde pagina als storing telt.
5. Opslaan. Je krijgt een mail als de site twee controles achter elkaar faalt, en weer een mail als hij terug is.

Tip: maak een tweede monitor op `https://www.frederiksbedrijfskleding.nl/` (de homepage). Valt alleen
de health-monitor om, dan ligt het aan de database (Supabase); vallen ze allebei om, dan aan de site (Vercel).

### Better Stack (gratis, controle elke 3 minuten, mooie statuspagina)

1. Maak een account op <https://betterstack.com/uptime>.
2. **Create monitor** > "Alert us when the URL **returns HTTP status other than 2XX**".
3. URL: `https://www.frederiksbedrijfskleding.nl/api/health`, interval 3 minuten.
4. Bij **On-call escalation**: e-mail en/of sms aan jezelf.
5. Optioneel: **Status pages** > een openbare statuspagina, handig om klanten naar te verwijzen bij een storing.

### Wat te doen bij een melding

1. Open de URL zelf. Geeft hij `{"status":"fout"}`? Kijk in Vercel > Logs op `[health]`:
   - `database niet geconfigureerd`: een omgevingsvariabele (`SUPABASE_SERVICE_ROLE_KEY`) ontbreekt.
   - `database gaf fout` of `onbereikbaar`: kijk op <https://status.supabase.com> en in het
     Supabase-dashboard of het project gepauzeerd is.
2. Laadt de URL helemaal niet? Kijk op <https://www.vercel-status.com> en bij Vercel > Deployments.

---

## Foutmeldingen in het KMS en portaal

Lijsten (orders, klanten, offertes, facturen, producten, taken) tonen bij een databasefout
een rood blok "De gegevens konden niet worden geladen" met **Opnieuw proberen**, in plaats van
een lege lijst. Onderaan staat een code (digest). In Vercel > Logs vind je bij dezelfde tijd
een regel die begint met `[db]`, met het onderdeel (bv. `orders.lijst`) en de foutcode van
Supabase. Persoonsgegevens staan daar niet in.
