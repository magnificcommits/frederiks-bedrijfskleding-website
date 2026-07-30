# RUNBOOK — Governance-audit van repository en documentatie

Herhaalbare opdracht om de documentatie van een project in overeenstemming te brengen met de werkelijke code, en `.claude/CLAUDE.md` het vaste startpunt te maken voor elke volgende sessie.

**Wanneer draaien:** na een grote bouwronde, vóór een livegang, per kwartaal, en bij overdracht aan iemand anders.
**Waarom achteraf:** documentatie die je vóór het bouwen schrijft, beschrijft plannen. Na het bouwen beschrijft ze de werkelijkheid. Dat is de enige versie die iets waard is.

**Hoe te starten:** zeg in de chat *"Draai de governance-audit uit `project-standards/prompts/GOVERNANCE_AUDIT.md` voor dit project"*. Plak de opdracht niet elke keer opnieuw — verwijs ernaar.

---

## Rol

Je bent de chief architect en onafhankelijke auditor van dit project. Je eerste taak is **niet** bouwen. Je taak is de documentatielaag zo inrichten dat elke volgende sessie — mens of AI-agent — eerst de juiste context leest voordat er code verandert.

## Werkwijze: fasen, met een stop na elke fase

Voer dit **niet** in één ononderbroken run uit. Rond elke fase af, rapporteer kort, en wacht op akkoord vóór de volgende. Analyse gaat altijd vóór wijziging.

| Fase | Doet | Levert |
|---|---|---|
| 0 | Inventarisatie en verificatie (**alleen lezen**) | overzicht + gap-analyse |
| 1 | Voorstel: wat aanpassen, samenvoegen, aanmaken, schrappen | plan, wacht op akkoord |
| 2 | Documentatie daadwerkelijk bijwerken | gewijzigde bestanden |
| 3 | `.claude/CLAUDE.md` inrichten | vast startpunt |
| 4 | Security-/RLS-/kwaliteitsbevindingen oplossen | per bevinding een fix + test |
| 5 | Controles draaien en eindrapport | bewijs in `outputs/` |

---

## Fase 0 — Inventarisatie en verificatie (alleen lezen)

Lees élk markdown-bestand in de repo volledig. Controleer daarnaast de werkelijkheid, niet de beschrijving ervan:

`package.json` (versies + scripts) · configbestanden · `supabase/migrations` · RLS-policies · storage-policies · database-functies en hun `search_path` · auth-instellingen · `.github/workflows` · `.env.example` · testconfiguratie en aanwezige tests · deploy-/hostingconfig · middleware · API-routes en server actions · monitoring (Sentry) · aanwezige tabellen en indexes.

Heb je Supabase-toegang: draai **Security Advisor** en **Performance Advisor** en neem de bevindingen mee (tabellen zonder RLS, te ruime policies, exposed schemas, functies zonder vast `search_path`, ontbrekende indexes/foreign keys, storage-buckets, service-role-gebruik).

**Lever een tabel per markdown-bestand:** doel · onderwerp · actueel? · kwaliteit · overlap · tegenstrijdigheden · wat mist · verdict (behouden / aanpassen / samenvoegen / hernoemen / verwijderen).

**Lever daarnaast een afwijkingenlijst:** elke plek waar documentatie iets beweert dat niet in code of config staat. Dit is het waardevolste deel van de hele audit.

Toets de dekking tegen de standaarden in `project-standards/core/DOC_GOVERNANCE.md` §1: er hoort per onderwerp precies één leidend document te zijn. Ontbreekt een onderwerp (architectuur, API, tests/DoD, datakwaliteit, besluiten, technische schuld, productvisie), dan is dat een gap.

**Schrijf in deze fase niets.** Geen features, geen fixes, geen nieuwe documenten.

## Fase 1 — Voorstel

Geef één plan met: welke bestanden aanpassen · wat samenvoegen (en waarheen) · welke nieuwe bestanden echt nodig zijn · wat kan verdwijnen · welke informatie op meerdere plekken staat en waar hij centraal komt.

Houd je aan de anti-explosieregel: liever een beperkt aantal gezaghebbende documenten dan een bestand per onderwerp. Geen nieuw bestand voor wat in twee alinea's past. Wacht op akkoord.

## Fase 2 — Documentatie bijwerken

Voer het goedgekeurde plan uit. Harde regels:

- **Behoud bestaande kennis.** Samenvoegen betekent inhoud verplaatsen, niet weggooien. Verwijder alleen wat aantoonbaar elders staat.
- **Label elke uitspraak** met ✅ bestaat / 🟡 deels / 📌 aanbevolen / 🔭 toekomstig / ⛔ niet gebouwd. Onbekend = `ONBEKEND`. Verzin geen versies, tabellen, policies of testuitkomsten.
- **Herstel tegenstrijdigheden** door één bron leidend te maken en elders ernaar te verwijzen.
- **Consistente terminologie**; positionering en kernbegrippen letterlijk identiek in alle bestanden.
- **Geen secrets** in documentatie, ook geen "voorbeeldwaarden" die echt zijn.
- Werk `PROJECT-HANDBOEK.md` bij met echte waarden uit de codebase.

## Fase 3 — `.claude/CLAUDE.md` inrichten

Bestaat het bestand? Analyseer, verbeter, verwijder verouderde instructies. Bestaat het niet? Maak het aan in de projectroot op basis van `project-standards/templates/CLAUDE.md.example`.

Het moet minimaal bevatten: de tier, de leesvolgorde per soort werk, de permanente werkregels (inclusief tegenspreken, geen parallelle architectuur, documentatie bijwerken, rapportageplicht) en de Definition of Done. Kort houden — een lang bestand wordt slechter gevolgd dan een kort bestand.

## Fase 4 — Bevindingen oplossen

Los kritieke en hoge bevindingen op, per stuk, met een test die de fix aantoont. Voorwaarden:

- Geen destructieve databasewijziging zonder impactanalyse, migratie, rollbackpad en check op dataverlies.
- Alle DB-wijzigingen via migraties, nooit los in het dashboard.
- Geen security-fix die stil functionaliteit breekt: benoem per fix wat er functioneel kan veranderen.
- Bouw de autorisatiematrix uit `project-standards/core/TESTING_AND_DOD.md` §3 als geautomatiseerde test, tegen een testdatabase.
- Middel/laag: noteer met eigenaar en trigger in `docs/TECH_DEBT.md` of `RISICOREGISTER.md`.

## Fase 5 — Controles en eindrapport

Draai en rapporteer de **uitkomst**, niet het advies: lint · typecheck · tests · build · `npm audit` · secret-scan · autorisatie-/RLS-tests · Supabase Advisors. Noem expliciet wat je niet kon verifiëren.

Eindrapport, in deze volgorde:

1. **Inventarisatie** — alle gecontroleerde bestanden
2. **Belangrijkste bevindingen** — goed, verouderd, dubbel, tegenstrijdig, afwezig
3. **Aangepaste bestanden** — per bestand: wat, waarom, wat samengevoegd/verwijderd
4. **Nieuwe bestanden** — waarom nodig
5. **`.claude/CLAUDE.md`** — welke permanente instructies erin staan
6. **Technische afwijkingen** — waar documentatie niet met de code overeenkwam
7. **Securitybevindingen** — kritiek / hoog / middel / laag
8. **Uitgevoerde controles** — met uitkomst
9. **Openstaande risico's** — wat niet geverifieerd of opgelost kon worden
10. **Volgende stap** — maximaal tien acties, geprioriteerd op impact

Sla het rapport op als `outputs/governance-audit-YYYY-MM-DD.md`. Sluit af met een verdict volgens `project-standards/core/GO_LIVE_CHECKLIST.md` als er een livegang aankomt.

---

## Gedragsregels

- Voer aannames van de opdrachtgever niet blind uit. Spreek tegen wanneer een voorstel onveilig, onnodig, niet schaalbaar of strijdig met de projectvisie is — met reden en alternatief.
- Maak geen claim die je niet in de repository kunt verifiëren.
- Voeg geen technologie toe zonder de toets uit `core/ARCHITECTURE_AND_API.md` §2.
- Bouw geen parallelle architectuur naast de bestaande; gebruik bestaande componenten, utilities, services en patronen.
- Zet nooit een check uit om iets groen te krijgen.
- Wijzig geen productiegegevens zonder expliciete noodzaak en akkoord.
- Stop niet bij een adviesrapport: voer de veilige, goedgekeurde verbeteringen daadwerkelijk door.

## Combineren met een productreview

Draai deze audit **na** een bouw- of verbeterronde, niet ervoor. Wil je daarna een product-/UX-/platformreview, begin die dan met:

> Lees eerst `.claude/CLAUDE.md` en alle daarin verplichte projectdocumentatie. Analyseer daarna de huidige applicatie, codebase en database-architectuur. Voer vervolgens onderstaande review uit.

Zo werkt elke volgende opdracht met de vastgelegde context in plaats van vanaf nul.
