# CI-workflows — installatie

Kant-en-klare GitHub Actions die de automatiseerbare checks **wekelijks** (en bij elke PR) draaien.
De assistent kan dit voor je doen — zeg: *"Installeer de CI-workflows uit de project-standards in dit project."*

## Wat staat hier

| Bestand hier | Kopieer naar | Draait | Doet |
|---|---|---|---|
| `dependabot.yml` | `.github/dependabot.yml` | wekelijks | Dependency-/security-updates als PR |
| `security-scan.yml` | `.github/workflows/security-scan.yml` | PR + ma 06:00 | Secret-scan, SAST, npm audit |
| `quality-monitor.yml` | `.github/workflows/quality-monitor.yml` | ma 07:00 | Lighthouse: speed/SEO/a11y/best-practices |
| `loadtest-smoke.yml` | `.github/workflows/loadtest-smoke.yml` | ma 08:00 + handmatig | k6-rooktest tegen staging |
| `loadtests-smoke.js` | `loadtests/smoke.js` | (door k6) | Het rooktest-script |

## Eenmalig instellen

1. Kopieer de bestanden naar de paden hierboven.
2. Zet repo-secrets (Settings → Secrets and variables → Actions):
   - `STAGING_URL` — de preview/staging-URL (nooit productie) voor Lighthouse + k6.
   - `SEMGREP_APP_TOKEN` — optioneel, koppelt aan Semgrep's gratis platform voor Pro-regels.
3. Zet **Dependabot** + **secret scanning + push protection** aan in Settings → Code security.
4. Maak in repo-settings de labels `dependencies` en `github-actions` aan (anders klaagt Dependabot).

## Gebruik je Aikido (of Snyk/vergelijkbaar)?

Aikido is een all-in-one platform dat SAST (Semgrep-klasse), SCA/dependency-scan én secret-scan
bundelt — en méér (DAST, IaC, malware). Heb je Aikido aangesloten op je repos, dan is
`security-scan.yml` **grotendeels overbodig**: laat die dan weg en gebruik Aikido als je
security-scanner. **Houd dan wél** `quality-monitor.yml` (Lighthouse: speed/SEO/a11y) en
`loadtest-smoke.yml` (k6) — die doet Aikido niet. `dependabot.yml` mag blijven voor automatische
update-PR's (Aikido vindt CVE's, Dependabot opent de upgrade-PR's).

> Aikido is betaald na de trial. Stop je ermee, zet dan `security-scan.yml` terug als gratis vangnet.

## Belangrijk

- **Alleen staging testen.** Lighthouse en k6 wijzen naar `STAGING_URL`. Richt dit nooit op productie of direct op Supabase — dat kan als aanval worden gezien.
- **Lighthouse = lab-data**, een vroege waarschuwing. De echte ranking-signalen komen uit veld-data (CrUX / Search Console). Zie `SPEED_OPTIMIZATION.md`.
- **Eerste week Dependabot** = veel PR's. Merge één voor één, niet allemaal samen (zie `cowork-playbook.md`).
- Andere stack dan npm/Next? Vraag de assistent de workflows te vertalen (pip/poetry, composer, go).
