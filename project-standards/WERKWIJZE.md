# WERKWIJZE — vaste sessieregels

> Dit bestand wordt via `@project-standards/WERKWIJZE.md` in de `CLAUDE.md` van het project
> geladen. Eén bron voor alle projecten: pas het hier aan, niet per project.

## 1. Bij sessiestart
Lees de subset die bij de tier van dit project hoort (de tier staat in de `CLAUDE.md` van het project):

- TIER 1 → `project-standards/core/`
- TIER 2 → `project-standards/core/` + `project-standards/data/`
- TIER 3 → `project-standards/core/` + `data/` + `project-standards/zorg/`

Lees niet alles elke keer; lees wat bij het werk hoort:

| Werk | Lees eerst |
|---|---|
| **Altijd** | `PROJECT-HANDBOEK.md` (feiten over dit project) · `core/SECURITY_AUDITOR.md` §1 |
| Architectuur / nieuwe techniek / API | `core/ARCHITECTURE_AND_API.md` (+ ADR schrijven) |
| Database, migraties, Supabase, RLS | `data/AUTH_AND_RLS.md` · handboek §8 · Tier 3: `zorg/MULTI_TENANT.md` |
| UI / UX | `core/UX.md` · `core/ACCESSIBILITY.md` · `core/ANTI_AI_DESIGN.md` |
| Content / copy | `core/ANTI_AI_WRITING.md` · `core/SEO_AEO.md` |
| Tests / CI / deploy | `core/TESTING_AND_DOD.md` · `ci/README.md` |
| Data- of AI-feature | `core/DATA_AND_AI_QUALITY.md` · `core/AI_RULES.md` |
| Persoonsgegevens | `data/AVG.md` |
| Vóór productie-deploy | `core/GO_LIVE_CHECKLIST.md` |
| Documentatie opschonen | `core/DOC_GOVERNANCE.md` · `prompts/GOVERNANCE_AUDIT.md` |

Beoordeel binnen de tier welke **extra** risico's spelen (AI-feature, uploads, betalingen,
multi-tenant) en pas de bijbehorende dieptecheck toe. Zie `project-standards/README.md`.

## 2. Permanente werkregels
- **Controleer de code, niet de documentatie.** Neem nooit aan dat iets bestaat omdat een `.md` het beweert; verifieer in code of config en verwijs naar bestand/regel.
- **Voer feedback niet blind uit.** Spreek tegen — met reden en alternatief — wanneer een voorstel onveilig, onnodig, niet schaalbaar of strijdig met de projectvisie is.
- **Geen parallelle architectuur.** Gebruik bestaande componenten, utilities, services en patronen. Een tweede implementatie van hetzelfde is een fout, ook als hij netter is.
- **Geen nieuwe technologie** zonder de toets uit `core/ARCHITECTURE_AND_API.md` §2.
- **Houd rekening met later, bouw het niet vooruit.** Voorbereiden is goedkoop, overengineering niet.
- **Bij elke databasewijziging:** RLS, autorisatie en tenant-isolatie controleren; migratie gebruiken; rollback beschrijven.
- **Bij functionele wijzigingen:** tests toevoegen of bijwerken.
- **Werk documentatie bij** zodra architectuur, database, security, API, gedrag of deploy verandert (`core/DOC_GOVERNANCE.md` §3).
- **Rapporteer bij afronding:** wat is gewijzigd, waarom, welke checks zijn gedraaid met uitkomst, wat je niet kon verifiëren en welk risico openblijft.

## 3. Wanneer een DEEP AUDIT verplicht is
Bij wijziging aan data, auth, routes, dependencies, uploads, webhooks of deploy-config:
draai een DEEP AUDIT volgens `core/SECURITY_AUDITOR.md`. Bij twijfel: DEEP AUDIT.

## 4. Afronden (Definition of Done)
Lint · typecheck · tests · build groen, plus de volledige lijst in `core/TESTING_AND_DOD.md` §1.
**Nooit een securitycheck uitzetten om een build groen te krijgen.**

## 5. Vóór productie
Doorloop `core/GO_LIVE_CHECKLIST.md` en geef een expliciet **GO / GO-MITS / NO-GO**.
Een control die bij de tier hoort, sla je alleen over met een geschreven reden (eigenaar + datum).

## 6. Projecthandboek
Houd `PROJECT-HANDBOEK.md` actueel: vul placeholders met echte waarden uit de codebase,
verwijder niet-toepasselijke secties. Verzin niets; onbekend = `ONBEKEND`.
