# TESTING & DEFINITION OF DONE

`SECURITY_AUDITOR.md` §6 noemt welke soorten tests er horen te zijn; dit document zegt **wat je minimaal test, hoe je het aantoont en wanneer werk klaar is**. De CI-workflows die dit afdwingen staan in `ci/`.

---

## 1. Definition of Done (niet onderhandelbaar)

Werk is pas klaar als álle punten kloppen. Niet "werkt op mijn machine".

- [ ] Lint groen
- [ ] Typecheck groen (`tsc --noEmit`)
- [ ] Build slaagt
- [ ] Tests groen, inclusief een test die de wijziging zelf dekt (nieuw of aangepast)
- [ ] Bij data-/auth-/route-wijziging: DEEP AUDIT gedraaid (`SECURITY_AUDITOR.md`)
- [ ] Bij DB-wijziging: migratie aanwezig, RLS gecontroleerd, rollback beschreven
- [ ] Relevante documentatie bijgewerkt (`DOC_GOVERNANCE.md`)
- [ ] Rapportage geleverd: wat is gewijzigd, waarom, welke checks zijn gedraaid met uitkomst, welk risico blijft open

**Geen check uitzetten om groen te worden.** Een `continue-on-error`, `eslint-disable`, `.skip()` of verzwakte policy "zodat het werkt" is een afgewezen oplossing (`AI_RULES.md`).

**Rapportageformat (assistent gebruikt dit als slotregel):**

> Gewijzigd: *[bestanden/onderdelen]* · Waarom: *[1 zin]* · Gedraaid: lint ✅ · typecheck ✅ · tests 12/12 ✅ · build ✅ *[+ audit/RLS indien van toepassing]* · Niet geverifieerd: *[expliciet]* · Restrisico: *[geen / wat]*.

---

## 2. Wat je test — en wat niet

Testen kost tijd; test waar falen pijn doet. Prioriteit van boven naar beneden:

| Prioriteit | Wat | Type |
|---|---|---|
| 1 | Autorisatie en data-isolatie (wie mag wat zien) | integratie/DB-test |
| 2 | Auth-flows: login, reset, magic link, logout, sessie-expiry | integratie of E2E |
| 3 | De kernflow die geld of vertrouwen oplevert (aanvraag, bestelling, boeking) | E2E |
| 4 | Businesslogica met rekenwerk, prijzen, datums, statusovergangen | unit |
| 5 | Mutatie-endpoints: validatie, foutpaden, idempotency | integratie |
| 6 | Regressies: elke bug krijgt eerst een falende test | unit/integratie |

**Niet testen:** styling, wrappers zonder logica, third-party-code, en getallen najagen. Coveragepercentage is geen doel; een ongetest autorisatiepad is een probleem, een ongeteste `<Button>` niet.

**Tier 1** (brochure): build + lint + typecheck + een smoke-test op de kernpagina's en het formulier. Meer is meestal verspilling.
**Tier 2+**: bovenstaande tabel volledig, plus §3.
**Tier 3**: §3 verplicht in CI, plus `zorg/MULTI_TENANT.md` en `zorg/PENTEST_PRE_GOLIVE.md`.

---

## 3. Autorisatiematrix (Tier 2+, verplicht in CI)

De duurste fout in een dataproject is dat iemand ziet wat niet voor hem bestemd is. Test dat expliciet en herhaalbaar, niet met de hand.

Bouw één testsuite die per **rol** en per **resource** de vier acties langsloopt. Vul de rollen in die dit project echt heeft:

| Rol | lezen | aanmaken | wijzigen | verwijderen |
|---|---|---|---|---|
| anoniem (geen sessie) | | | | |
| ingelogde eindgebruiker (eigen data) | | | | |
| ingelogde eindgebruiker (data van een ánder) | ⛔ moet falen | ⛔ | ⛔ | ⛔ |
| professional / medewerker | | | | |
| externe partner (API-key) | | | | |
| beheerder | | | | |
| gebruiker uit een andere tenant | ⛔ moet falen | ⛔ | ⛔ | ⛔ |
| `service_role` (alleen server) | n.v.t. in test via client | | | |

Aanvullend, in dezelfde suite:

- [ ] **Directe API-aanroep** met geldige sessie maar geforceerd ander ID (IDOR) → faalt
- [ ] **Storage**: bestand van een andere gebruiker/tenant opvragen via directe URL → faalt
- [ ] **`security definer`-functies**: geven geen data terug die de rol niet mag zien
- [ ] **Zoeken, exports en aggregaties**: geen rijen van anderen in het resultaat
- [ ] **Sessie na logout** is ongeldig; verlopen token wordt geweigerd

**Een test die "geen fout geeft" is niet hetzelfde als een test die aantoont dat toegang wordt geweigerd.** Assert op de weigering (0 rijen, 401/403), niet op het uitblijven van een exception.

Praktisch: pgTAP of een script met twee Supabase-clients (twee echte testgebruikers uit een seed) dekt dit met tientallen regels code. Draai het in `ci.yml` tegen een testdatabase — nooit tegen productie.

---

## 4. Testdata

- Seed-script in de repo, reproduceerbaar, zonder echte klantdata.
- **Nooit een productiedump in dev of preview.** Wil je realistisch volume: genereer het.
- Testgebruikers per rol, met vaste ID's, zodat de matrix uit §3 leesbaar blijft.
- Preview-omgeving heeft eigen database en eigen secrets (`GO_LIVE_CHECKLIST.md`).

## 5. Review

Werk je alleen? Dan is een menselijke review niet altijd haalbaar — maak de technische poort dan strenger (`ci/README.md`). Wat je in elk geval zelf nagaat vóór merge:

- [ ] Diff volledig gelezen — geen meegekomen debug-code, TODO's, sleutels of `console.log` met data
- [ ] Geen nieuwe dependency zonder reden (§2 van `ARCHITECTURE_AND_API.md`)
- [ ] Geen gewijzigde security-config die niet in de PR-beschrijving staat
- [ ] Migratie los reviewbaar en backwards compatible

## 6. Bewijs bewaren

Testuitkomsten die een verdict onderbouwen horen in `outputs/` (zie `GO_LIVE_CHECKLIST.md`). Geen bewijsbestand = de check telt als niet uitgevoerd.
