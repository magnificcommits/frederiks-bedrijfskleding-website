# Wekelijkse monitor — alle facetten in één rapport

Veiligheid en kwaliteit verlopen na go-live. Houd het bij via twee lagen:

1. **Automatisch in de repo** (GitHub Actions in `ci/`) — de meetbare, automatiseerbare checks.
2. **Wekelijkse Cowork-agent** — het holistische oordeel over álle facetten, met prioriteiten, in je chat.

Samen ≠ 100% dekking, maar wel een betrouwbaar vangnet dat problemen vroeg zichtbaar maakt in plaats van bij een klacht van een klant.

---

## Laag 1 — Automatisch in de repo (zie `ci/`)

| Workflow | Wanneer | Dekt |
|---|---|---|
| `security-scan.yml` | PR + ma 06:00 | Secrets, SAST, dependency-CVE's |
| `quality-monitor.yml` | ma 07:00 | Speed/SEO/a11y/best-practices (Lighthouse) |
| Dependabot | wekelijks | Dependency-/security-PR's |

Installeer eenmalig via `ci/README.md`. Resultaten verschijnen in het GitHub-tabblad Actions/Security.

---

## Laag 2 — De wekelijkse Cowork-agent (geplande taak)

Dit is de prompt die wekelijks draait. Hij vat de automatische resultaten samen én checkt wat een mens/assistent nog moet beoordelen. Eén rapport, oordeel per facet.

> **Wekelijkse projectmonitor.** Loop de facetten hieronder langs voor dit project. Draai waar mogelijk zelf de checks (of lees de laatste GitHub Actions-resultaten) en rapporteer de **uitkomst**, niet alleen advies. Geef per facet een status (🟢/🟠/🔴) en sluit af met de top-3 acties voor deze week, geprioriteerd op impact. Houd het kort en concreet. Sla het rapport op als `outputs/weekly-monitor-YYYY-MM-DD.md` en noem expliciet wat je niet kon verifiëren. Stem de facetten af op de tier (zie README): Tier 1 = facetten 1-6 + 8-9; Tier 2+ ook 7 en privacy; Tier 3 ook tenant-isolatie.
>
> Facetten:
> 1. **Security** — nieuwe `npm audit`/Dependabot/SAST/secret-scan-bevindingen sinds vorige week? Nieuwe routes/auth/DB-wijzigingen die een DEEP AUDIT vragen (`core/SECURITY_AUDITOR.md`)? Open kritieke/hoge bevindingen nog open?
> 2. **Dependencies** — openstaande security-PR's; framework op ondersteunde versie zonder CVE.
> 3. **Speed / Core Web Vitals** — veld-data uit Search Console (LCP/INP/CLS op 75e percentiel) + laatste Lighthouse-run. Degradatie t.o.v. vorige week? (`core/SPEED.md`)
> 4. **SEO / AEO** — indexeringsfouten/dekking in Search Console, kapotte canonicals/sitemap, dalende posities; verschijnt de site in AI-antwoorden op kernvragen? (`core/SEO_AEO.md`)
> 5. **Content & design** — nieuwe content gepubliceerd zonder de de-AI-check (`core/ANTI_AI_WRITING.md`)? Generieke-design-regressies (`core/ANTI_AI_DESIGN.md`)?
> 6. **Meten & conversie** — north-star + funnel: trend t.o.v. vorige week; grootste afhaakstap. (`core/MEASUREMENT.md`)
> 7. **Betrouwbaarheid** (Tier 2+) — uptime/errors (Sentry), backups draaien, geen nieuwe 5xx-pieken. (`data/INCIDENT_RESPONSE.md`)
> 8. **UX & toegankelijkheid** — automatische a11y-scan schoon? Nieuwe UI zonder WCAG-/states-check? (`core/UX.md`, `core/ACCESSIBILITY.md`)
> 9. **AVG/privacy** (bij persoonsgegevens) — nieuwe dataverwerking zonder grondslag/DPIA-afweging? Verlopen verwerkersovereenkomsten? (`data/AVG.md`)
> 10. **AI-features** (indien aanwezig) — kosten/spend binnen budget; geen prompt-injection-/output-incidenten; rate-limits intact. (`core/AI_RULES.md`, sectie product-LLM)
>
> Format per facet: `Facet — status — 1 zin bevinding — actie indien nodig`.

### Hoe je deze agent inplant
Zeg in de chat: **"Plan de wekelijkse projectmonitor elke maandagochtend in voor dit project."** Er wordt dan een geplande taak gemaakt die bovenstaande prompt elke maandag draait en je het rapport geeft. (Vereist dat het project als map gekoppeld is.) Pas dag/tijd/facetten naar wens aan.
