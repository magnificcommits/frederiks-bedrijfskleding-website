# Frederiks Bedrijfskleding API v1: medewerkers in en uit dienst

Met deze API geeft het HR-systeem van een klant zelf door wie er in dienst komt, wie er
vertrekt en wat er verandert. Het kledingpakket en het budget in het klantportaal kloppen
dan direct, en Frederiks krijgt automatisch een taak om het pakket klaar te zetten of de
kleding in te nemen.

- Basis-URL: `https://www.frederiksbedrijfskleding.nl/api/v1`
- Formaat: JSON (UTF-8). Datums als `JJJJ-MM-DD`, tijdstippen als ISO 8601.
- Limiet: 60 verzoeken per minuut per sleutel. Daarboven `429` met `Retry-After`.
- Uitleg in het KMS: `/dashboard/instellingen/api`.

## Sleutel

Elke klantorganisatie krijgt een eigen sleutel (`fb_live_` + 32 tekens). Frederiks maakt
hem aan in het KMS (klant > tabblad Koppelingen) en ziet hem één keer. Opgeslagen wordt
alleen een SHA-256-hash en de laatste 4 tekens. Een sleutel ziet en wijzigt alleen de
medewerkers van zijn eigen klant. Intrekken werkt direct.

```
Authorization: Bearer fb_live_JOUW_SLEUTEL
```

Een sleutel kan alleen-lezen zijn (`medewerkers:lezen`) of ook mogen schrijven
(`medewerkers:schrijven`).

## Medewerker

```json
{
  "personeelsnummer": "1001",
  "naam": "Sanne de Vries",
  "email": "sanne.devries@klant.nl",
  "afdeling": "Werkplaats",
  "functie": "Monteur",
  "startdatum": "2026-11-01",
  "einddatum": null,
  "status": "in_dienst",
  "bron": "api",
  "bijgewerkt_op": "2026-10-05T08:12:44.120Z"
}
```

- `status`: `in_dienst`, `uit_dienst_gepland` (einddatum in de toekomst) of `uit_dienst`.
- `bron`: `api`, `csv` of `handmatig`.
- `afdeling` moet bij Frederiks al bestaan (op naam, hoofdletters maken niet uit). Een
  onbekende afdeling wordt niet aangemaakt; het antwoord bevat dan een `waarschuwingen`-lijst.

## Endpoints

### GET /medewerkers

Lijst van de medewerkers van de klant, op naam gesorteerd.

| Parameter | Standaard | Uitleg |
|---|---|---|
| `status` | `alle` | `in_dienst` (inclusief gepland uit dienst), `uit_dienst` of `alle` |
| `gewijzigd_sinds` | - | ISO-tijdstip; alleen medewerkers die sindsdien zijn bijgewerkt |
| `limit` | `100` | maximaal 500 |
| `offset` | `0` | voor de volgende pagina |

```bash
curl "https://www.frederiksbedrijfskleding.nl/api/v1/medewerkers?status=in_dienst&limit=100" \
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL"
```

Antwoord: `{ "data": [ ...medewerkers ], "totaal": 143, "limit": 100, "offset": 0 }`

### GET /medewerkers/{personeelsnummer}

Eén medewerker: `{ "data": { ...medewerker } }`, of `404`.

### POST /medewerkers (in dienst)

| Veld | Verplicht | Uitleg |
|---|---|---|
| `naam` | ja | volledige naam |
| `personeelsnummer` | ja, of `email` | letters, cijfers, `.` `_` `-`, max 40 tekens |
| `email` | ja, of `personeelsnummer` | |
| `afdeling` | nee | naam van een bestaande afdeling |
| `functie` | nee | |
| `startdatum` | nee | standaard vandaag |
| `voornaam`, `achternaam` | nee | los bewaard naast `naam` |

Idempotent: bestaat het personeelsnummer (of anders het e-mailadres) al bij deze klant, dan
wordt de medewerker bijgewerkt in plaats van dubbel aangemaakt. Stond hij uit dienst, dan
komt hij weer in dienst.

```bash
curl -X POST https://www.frederiksbedrijfskleding.nl/api/v1/medewerkers \
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL" \
  -H "Content-Type: application/json" \
  -d '{"naam":"Sanne de Vries","email":"sanne.devries@klant.nl","personeelsnummer":"1001","afdeling":"Werkplaats","functie":"Monteur","startdatum":"2026-11-01"}'
```

Antwoord `201` (nieuw) of `200` (bestond al):

```json
{ "resultaat": "aangemaakt", "medewerker": { "...": "..." } }
```

`resultaat` is `aangemaakt`, `bijgewerkt`, `ongewijzigd` of `weer_in_dienst`.

### PATCH /medewerkers/{personeelsnummer}

Stuur alleen de velden die veranderen: `naam`, `email`, `afdeling`, `functie`,
`startdatum`, `voornaam`, `achternaam` of een nieuw `personeelsnummer`.

```bash
curl -X PATCH https://www.frederiksbedrijfskleding.nl/api/v1/medewerkers/1001 \
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL" \
  -H "Content-Type: application/json" \
  -d '{"afdeling":"Buitendienst","functie":"Servicemonteur"}'
```

### POST /medewerkers/{personeelsnummer}/uitdienst

Body optioneel: `{ "einddatum": "2026-12-31" }` (standaard vandaag). De medewerker wordt
niet verwijderd. Tot de einddatum is de status `uit_dienst_gepland`, daarna `uit_dienst`
(de medewerker staat dan op niet-actief). Nog een keer sturen met dezelfde datum geeft
`resultaat: "ongewijzigd"`.

```bash
curl -X POST https://www.frederiksbedrijfskleding.nl/api/v1/medewerkers/1001/uitdienst \
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL" \
  -H "Content-Type: application/json" \
  -d '{"einddatum":"2026-12-31"}'
```

## Fouten

Altijd in dezelfde vorm:

```json
{
  "fout": {
    "code": "ongeldige_invoer",
    "bericht": "Niet alle velden kloppen.",
    "details": [{ "veld": "startdatum", "bericht": "Gebruik het formaat JJJJ-MM-DD, bijvoorbeeld 2026-11-01." }]
  }
}
```

| Status | Code(s) | Wanneer |
|---|---|---|
| 400 | `geen_json` | geen of ongeldige JSON |
| 401 | `geen_sleutel`, `ongeldige_sleutel` | geen sleutel of sleutel bestaat niet (meer) |
| 403 | `geen_toegang` | sleutel mist de juiste scope |
| 404 | `niet_gevonden` | onbekend personeelsnummer bij deze klant |
| 409 | `conflict` | bv. e-mailadres hoort al bij een ander personeelsnummer |
| 422 | `ongeldige_invoer`, `ongeldige_parameters`, `ongeldig_personeelsnummer` | velden kloppen niet |
| 429 | `te_veel_verzoeken` | meer dan 60 verzoeken per minuut |
| 500 | `serverfout` | fout aan onze kant |

## Wat er bij Frederiks gebeurt

- Elk verzoek komt in het logboek van de klant (tabel `api_log`, zichtbaar op het tabblad
  Koppelingen). Wijzigingen staan ook in het algemene logboek (`audit_log`) met de naam van
  de sleutel als actor.
- Bij een nieuwe medewerker of een eerste uitdienstmelding maakt het KMS een taak aan voor
  Jessi: "Nieuwe medewerker bij <klant>: pakket klaarzetten" of "Uit dienst bij <klant>:
  kleding innemen".

## CSV-import (zonder koppeling)

Op hetzelfde tabblad kan Frederiks een CSV-bestand importeren met de kolommen
`naam;email;personeelsnummer;afdeling;startdatum;einddatum`. Eerst verschijnt een
voorvertoning (nieuw, bijwerken, uit dienst, overslaan); pas na bevestigen wordt er iets
opgeslagen. Een rij met een einddatum zet de medewerker uit dienst. Er komt één
verzameltaak voor de nieuwe en één voor de vertrokken medewerkers.

## Technisch

- Code: `app/api/v1/medewerkers/**`, `lib/api/*`, `lib/kms/hrKoppeling.ts`.
- Database: migratie `supabase/migrations/20261005_api_sleutels_hr.sql`
  (`api_sleutels`, `api_log`, kolommen `medewerkers.bron` en `medewerkers.bijgewerkt_op`).
