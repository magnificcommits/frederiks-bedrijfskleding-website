# Golden Template — Orkest & Agency Setup

## Principe: één engine, configureerbaar
Eén golden template. Branche-verschillen los je op met **config en content**, niet met aparte repos. Elke verbetering of security-fix doe je dan één keer, niet per branche.

Fout: `template-catering`, `template-dierenarts`, `template-industrie` (4x onderhoud).
Goed: `tim-golden-template` + `config/presets/*` (1x onderhoud).

---

## Repo-structuur

```
tim-golden-template/            ← GitHub Template Repository
├── project-standards/          ← HET ORKEST (reist mee bij elke kloon)
│   ├── README.md                tier-selector + eindvraag
│   ├── core/                    SECURITY_AUDITOR, GO_LIVE_CHECKLIST, AI_RULES,
│   │                            ANTI_AI_WRITING, ANTI_AI_DESIGN, ACCESSIBILITY,
│   │                            SEO_AEO, SPEED, MEASUREMENT, UX
│   ├── data/                    AUTH_AND_RLS, AVG, INCIDENT_RESPONSE
│   ├── zorg/                    MULTI_TENANT, DATA_BREACH_PLAYBOOK, PENTEST_PRE_GOLIVE
│   ├── ci/                      GitHub Actions (security-scan, quality-monitor, Dependabot)
│   └── templates/               herbruikbare bestanden (o.a. llms.txt)
├── .claude/
│   └── CLAUDE.md                projectregel: "Dit project is TIER N → volg project-standards/…"
├── config/
│   ├── site.ts                  centrale config: naam, domein, kleuren, contact
│   └── presets/
│       ├── local-business.ts    blokken + defaults per branche
│       ├── catering.ts
│       ├── dierenarts.ts
│       └── industrie.ts
├── src/
│   ├── app/                     Next.js routes
│   ├── components/blocks/       herbruikbare secties (hero, FAQ, reviews, CTA)
│   ├── lib/sanity/              Sanity client + queries
│   └── lib/seo/                 metadata helpers, JSON-LD
├── README.md                    onboarding-checklist (1-4u live)
└── .env.example
```

De `project-standards/` map is het verschil tussen een template en een systeem. Hij zorgt dat elke klant-repo automatisch je standaarden, security-audit en merkregels meekrijgt. In `.claude/CLAUDE.md` zet je één regel die de tier kiest en naar `project-standards/` verwijst; daarmee leest de agent de juiste subset. Geen handmatige koppeling nodig.

---

## Per-klant onboarding (doel: 1-4u technisch live)

1. GitHub → "Use this template" → `dierenkliniek-coenen-website`
2. Kies preset in `config/site.ts` (bijv. `dierenarts`)
3. Vul `config/site.ts`: naam, domein, kleuren, contactgegevens, Sanity project ID
4. Vervang logo + favicon
5. Nieuw Sanity project aanmaken, project ID koppelen
6. Vercel: import repo → env vars zetten (uit `.env.example`)
7. Resend domein verifiëren voor contactformulier
8. Cookiebanner + GA-id invullen
9. Deploy → check `project-standards/core/SECURITY_AUDITOR.md` Fast Check
10. Domein koppelen

Daarna zit de tijd in content, foto's en SEO — dat is je facturabele werk, niet de techniek.

---

## Branche = preset, geen aparte repo

Een preset bepaalt:
- welke blokken standaard aan staan (dierenarts: openingstijden + spoednummer; catering: menu + bestelflow; industrie: specs + offerte-CTA)
- default kleuren en toon
- welke Sanity-schema's geladen worden
- standaard SEO-structuur voor die branche

Eén klant afwijkend? Override in `config/site.ts`. Geen fork van de template.

---

## Propagatie van verbeteringen (de echte "overal het beste uithalen")

Template-repos hebben één tradeoff: verbeter je de template, dan updaten bestaande klant-repos niet vanzelf.

**Fase 1 (nu, tot ~5 klanten):**
Alles in de golden template. Simpel, snel. Verbeteringen pas je handmatig toe bij de paar klanten waar het telt.

**Fase 2 (pas bij ~5+ klanten, als onderhoud pijn doet):**
Trek gedeelde logica in private npm-packages:
- `@tim/ui` — componenten/blokken
- `@tim/seo` — metadata + schema helpers
- `@tim/security-config` — headers, RLS-patronen, Zod-schemas

Klant-repos krijgen deze als dependency. Eén fix → versie bumpen → `npm update` per klant. Fixes propageren.

Bouw Fase 2 niet vooruit. Het is overhead die je nu niet terugverdient.

---

## Beslissingen (vast)

| Vraag | Keuze |
|---|---|
| Aantal templates | Eén golden template |
| Branche-varianten | Presets in config, geen aparte repos |
| Standaarden (security/merk/SEO) | In `project-standards/` binnen de template, geactiveerd via `.claude/CLAUDE.md` |
| Repos koppelen per klant | Nee — standaarden reizen mee via "Use this template" |
| Package-laag | Pas bij 5+ klanten |
| Eerste actie | Golden template afbouwen + `.claude/` vullen + op Template zetten |
