# DOCUMENTATIE-GOVERNANCE

Documentatie is onderdeel van de codebase, geen administratie ernaast. Dit document bepaalt **welk bestand leidend is per onderwerp, wanneer je bijwerkt, en wat je niet mag opschrijven**.

Grondregel uit `README.md`: een `.md` beschrijft een controle, hij beschermt niets. Een doc dat niet matcht met de echte config is in een audit erger dan geen doc — het bewijst dat je een controle claimde die je niet had.

---

## 1. Eén bron van waarheid per onderwerp

Staat security op drie plekken beschreven, dan zijn er binnen een half jaar drie verschillende waarheden. Per onderwerp is precies één bestand leidend; elders verwijs je ernaar.

| Onderwerp | Leidend bestand |
|---|---|
| Wanneer welke standaarden gelden (tier) | `README.md` |
| Werkregels voor elke sessie | `.claude/CLAUDE.md` in de projectroot |
| Feiten over dít project (stack, env, tabellen, deploy) | `PROJECT-HANDBOEK.md` |
| Security, privacy, compliance, reliability | `core/SECURITY_AUDITOR.md` |
| Auth, autorisatie, RLS, admin-hardening, secrets | `data/AUTH_AND_RLS.md` |
| Tenant-isolatie | `zorg/MULTI_TENANT.md` |
| Architectuur, techniekkeuze, API-strategie | `core/ARCHITECTURE_AND_API.md` |
| Tests, Definition of Done, review | `core/TESTING_AND_DOD.md` |
| CI/CD en repo-instellingen | `ci/README.md` |
| Regels voor AI-agents en product-LLM's | `core/AI_RULES.md` |
| Datakwaliteit en AI-output naar gebruikers | `core/DATA_AND_AI_QUALITY.md` |
| Privacy, bewaartermijnen, verwerkers | `data/AVG.md` |
| Incidenten, backup, continuïteit | `data/INCIDENT_RESPONSE.md` |
| Livegang-verdict | `core/GO_LIVE_CHECKLIST.md` |
| Losse besluiten | `docs/decisions/` (`templates/ADR.md`) |
| Productvisie en platformstrategie | project-eigen doc (`templates/PRODUCT_EN_PLATFORM.md`) |

Wijkt een project hiervan af, dan pas je deze tabel aan in plaats van er een tweede structuur naast te zetten.

---

## 2. Bewijsregel: label elke uitspraak

Documentatie mag niets als bestaand beschrijven wat niet aantoonbaar in code of config staat. Gebruik daarom labels:

| Label | Betekenis | Eis |
|---|---|---|
| ✅ bestaat | aanwezig in code/config | verwijs naar bestand of instelling |
| 🟡 deels | aanwezig maar incompleet | benoem wat mist |
| 📌 aanbevolen | besloten, nog niet gebouwd | eigenaar + datum |
| 🔭 toekomstig | idee, geen commitment | geen actie |
| ⛔ niet gebouwd | expliciet afwezig | voorkomt valse aanname |

Onbekend blijft `ONBEKEND`. Verzin nooit een RLS-policy, versienummer, tabel of testuitkomst "die er wel zal zijn". Een veiligheidsclaim zonder testuitkomst eronder is een overtreding van `AI_RULES.md`.

---

## 3. Wanneer bijwerken (triggers)

Documentatie bijwerken hoort bij de wijziging, niet bij "later opruimen". Verplicht bij:

| Wijziging | Werk bij |
|---|---|
| Nieuwe/gewijzigde tabel, migratie of RLS-policy | `PROJECT-HANDBOEK.md` §8 |
| Nieuwe env var of secret | handboek §6 + `templates/SECRET_REGISTER.md` |
| Nieuwe route, server action, webhook of integratie | handboek §7/§11 |
| Nieuwe dependency of stackwijziging | handboek §2 |
| Architectuur- of API-besluit | ADR in `docs/decisions/` |
| Deploy-, CI- of hostingwijziging | handboek §10 + `ci/README.md` |
| Bewust uitgestelde verbetering | `templates/TECH_DEBT.md` |
| Geaccepteerd restrisico | `templates/RISICOREGISTER.md` + go-live-verdict |
| Livegang | `outputs/go-live-report-YYYY-MM-DD.md` |

Kost het bijwerken meer dan een paar regels? Dan is dat een signaal dat de wijziging groter is dan hij leek.

---

## 4. Voorkom documentatie-explosie

Meer bestanden is niet meer grip. Vuistregels:

- **Geen nieuw bestand** voor een onderwerp dat in twee alinea's in een bestaand bestand past.
- Een nieuw bestand mag alleen als het een **eigen beslismoment** heeft en een eigen leidend onderwerp uit §1 is.
- Overlap tussen twee bestanden: kies één eigenaar, vervang de rest door een verwijzing in één regel.
- Verwijder pas als de inhoud aantoonbaar elders staat. Kennis kwijtraken is erger dan een bestand te veel.
- Documentatie voor een project of tier dat nog niet bestaat, schrijf je niet: die test je nooit, en ongeteste docs verzwakken je in een audit.

**Maximaal:** één handboek met de feiten, één leidend document per onderwerp, één ADR per besluit, één register per risico-soort.

## 5. Periodieke controle

- **Per PR:** raakt de wijziging een trigger uit §3, dan hoort de doc-update in dezelfde PR.
- **Wekelijks:** de monitorronde uit `WEEKLY_MONITOR.md` benoemt wat achterloopt.
- **Per kwartaal of vóór livegang:** volledige governance-ronde via `prompts/GOVERNANCE_AUDIT.md` — inventarisatie, tegenstrijdigheden, code-versus-doc-verificatie.
