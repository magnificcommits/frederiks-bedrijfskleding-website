# ARCHITECTUUR & API

Leidend document voor architectuurkeuzes en API-strategie. Security-details staan in `SECURITY_AUDITOR.md` en `data/AUTH_AND_RLS.md` — die blijven daar leidend; hier staat de *structuur*.

**Scope per tier:** Tier 1 → alleen §1 en §5 (kort, meestal drie regels). Tier 2+ → volledig. Tier 3 / multi-tenant platform → volledig plus `zorg/MULTI_TENANT.md`.

---

## 1. Vastleggen wat er echt staat

Beschrijf de architectuur één keer, op de plek waar hij hoort: `PROJECT-HANDBOEK.md` §7 (dataflow) en §8 (database). Dit document geeft de **regels**, het handboek de **feiten**. Verdubbel ze niet.

Label elke uitspraak over het systeem met een status. Zonder label is documentatie een aanname:

| Label | Betekenis |
|---|---|
| ✅ bestaat | aantoonbaar in code of config (met bestand:regel) |
| 🟡 deels | aanwezig maar incompleet of niet overal toegepast |
| 📌 aanbevolen | besloten dat het moet, nog niet gebouwd |
| 🔭 toekomstig | mogelijk later, geen commitment |
| ⛔ niet gebouwd | expliciet niet aanwezig (voorkomt valse aannames) |

Zie `DOC_GOVERNANCE.md` voor de bewijsregel.

---

## 2. Technologie toevoegen — de rem

Elke laag die je toevoegt, moet je onderhouden, beveiligen, updaten en uitleggen aan de volgende developer. Nieuwe techniek (Redis, queue, event bus, API-gateway, OpenTelemetry, microservice, extra database, state-library) mag **alleen** met alle vier onderstaande punten schriftelijk:

1. **Het concrete probleem** — met meting of incident, niet "voor als we groeien".
2. **Waarom de huidige oplossing tekortschiet** — wat is er precies geprobeerd.
3. **De meerwaarde tegen de extra complexiteit** — wie onderhoudt dit over een jaar.
4. **Past het bij deze fase** — aantal gebruikers, omzet, teamgrootte nu.

Ontbreekt er één? Dan niet toevoegen. Leg de afweging vast als ADR (`templates/ADR.md`).

**Standaardantwoord op schaalbaarheidsvragen:** Postgres met goede indexes, Vercel-caching en `revalidate` dekken bijna alles tot serieus volume. Meet eerst, optimaliseer daarna.

**Wat wél bijna altijd terugverdient:** indexes op filterkolommen, correcte cache-headers/revalidatie, een achtergrondtaak voor werk >10s (Supabase cron of Vercel cron), en error tracking. Dat is geen nieuwe architectuur, dat is de huidige stack goed gebruiken.

---

## 3. Uitbreidbaar bouwen zonder overengineering

- **Eén domeinbegrip = één plek.** Geen tweede implementatie van dezelfde logica in een andere laag. Een parallelle architectuur naast de bestaande is een fout, ook als hij netter is: kies migreren of laten staan, niet naast elkaar.
- **Businesslogica niet in de UI.** Componenten renderen; services/queries beslissen. Anders is een tweede kanaal (API, app, integratie) later onmogelijk zonder duplicatie.
- **Autorisatie in de datalaag, niet alleen in de route.** RLS als bodem, route-checks als tweede laag. Zo blijft een nieuwe consumer (API, cron, edge function) automatisch veilig.
- **Uitbreidingspunt = data, geen code-fork.** Nieuwe klant, branche of verticaal hoort een config/preset/tenant-rij te zijn (zie `GOLDEN_TEMPLATE_SETUP.md`), geen kopie van de codebase.
- **Voorbereiden ≠ bouwen.** Een schone servicelaag en een `tenant_id` vanaf dag één zijn goedkoop. Een event bus voor één consumer is dat niet.

## 4. Architecture Decision Records (ADR)

Leg elke keuze die later duur is om terug te draaien vast in `docs/decisions/NNNN-titel.md` via `templates/ADR.md`: framework- en databasekeuze, auth-model, tenant-model, multi-tenancy-strategie, cache-strategie, API-vorm, betaalprovider, hosting, en elke afwijking van deze standaarden.

Eén pagina per besluit: context · besluit · alternatieven · gevolgen. Een ADR wijzig je niet — je schrijft een nieuwe die de oude vervangt (status `superseded`).

---

## 5. API-strategie

### Bouw geen publieke API omdat het "hoort"

Een publieke API is een contract dat je jaren onderhoudt: versiebeheer, documentatie, rate limiting, support, backwards compatibility. Bouw hem pas als er een **betalende of strategisch noodzakelijke afnemer** is die je bij naam kunt noemen. Tot die tijd: interne contracten netjes, extern dicht.

| Laag | Wanneer | Eisen |
|---|---|---|
| **Intern** (server actions, route handlers) | altijd | authn + authz server-side, Zod-validatie, geen impliciet UI-vertrouwen |
| **Partner** (1-op-1 integratie) | zodra één externe partij data uitwisselt | key per partner, scopes, rate limit, logging per key, contract op schrift |
| **Publiek** (open documentatie) | pas bij meerdere afnemers en een verdienmodel | versionering, changelog, deprecatiebeleid, statuspagina, support |

### Eisen zodra data het systeem verlaat

- [ ] **Authenticatie per afnemer** — eigen key/credential, nooit een gedeelde. Intrekbaar zonder anderen te raken.
- [ ] **Autorisatie per resource** — scopes/rollen; een key ziet alleen de eigen tenant.
- [ ] **Rate limiting + quota** per key, met `429` en `Retry-After`. Fail-closed (zie `GO_LIVE_CHECKLIST.md`).
- [ ] **Versionering** in het pad (`/v1/`). Breaking change = nieuwe versie, geen stille wijziging.
- [ ] **Idempotency** op alle schrijf-endpoints (`Idempotency-Key`), zodat een retry niet dubbel boekt.
- [ ] **Webhooks**: signatureverificatie, replay-/timestampcheck, retries met backoff, dead-letter.
- [ ] **Contract vastgelegd** (OpenAPI of getypeerd schema) en getest, niet alleen beschreven.
- [ ] **Nooit publiek**: interne ID's die volume verraden, ruwe persoonsgegevens zonder grondslag, kostprijs-/margegegevens, en alles wat je niet in een screenshot van een concurrent wilt zien.

### Deprecatie

Een endpoint uitzetten doe je in drie stappen: aankondigen met datum → `Deprecation`-header + waarschuwing in de response-logs → uitzetten. Minimaal één releasecyclus ertussen, en nooit zonder dat je in de logs kunt zien wie hem nog gebruikt.

---

## 6. Checklist bij architectuurwijziging

- [ ] Bestaande implementatie gelezen vóór het toevoegen van een patroon (geen parallelle architectuur)
- [ ] Nieuwe techniek getoetst aan de vier punten uit §2, of niet toegevoegd
- [ ] ADR geschreven bij een moeilijk terug te draaien keuze
- [ ] `PROJECT-HANDBOEK.md` §7/§8 bijgewerkt met de nieuwe werkelijkheid
- [ ] Autorisatie meegenomen tot in de datalaag (RLS), niet alleen in de route
- [ ] DEEP AUDIT gedraaid als routes, data, auth of deploy-config raken (`SECURITY_AUDITOR.md`)
- [ ] Migratie backwards compatible + rollback beschreven (`GO_LIVE_CHECKLIST.md`)
