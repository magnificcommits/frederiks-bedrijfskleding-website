# Project Standards — Orkest & Trigger-systeem

Eén map die je in elk project zet. Subfolders per risico-tier. Je activeert per project alleen wat nodig is. Een brochure-site gebruikt alleen `core/`, je zorgsoftware de volledige set.

Zet deze map in de root van je golden template, dan reist hij mee bij elke "Use this template". Kopieer hem in bestaande projecten.

De standaarden beantwoorden één eindvraag: **"Kunnen we naar een veilige productieomgeving?"** → GO / GO-MITS / NO-GO via `core/GO_LIVE_CHECKLIST.md`.

---

## Kernregel: documentatie ≠ beveiliging

Een `.md` beschrijft een controle. Hij beschermt niets. Echte beveiliging zit in code (Zod, server-side authz, RLS), platform-config (RLS aan, security headers, secret scanning, Dependabot) en CI (audit, typecheck, secret scan per PR). Een doc die niet matcht met je echte config is in een audit erger dan geen doc: het bewijst dat je een controle claimde die je niet had.

---

## Map-structuur

```
project-standards/
├── README.md                    ← dit bestand (tier-selector)
├── GOLDEN_TEMPLATE_SETUP.md     ← agency-orkest: één template, presets, uitrol
├── WEEKLY_MONITOR.md            ← wekelijkse cadans: CI + Cowork-agent
├── cowork-playbook.md           ← praktische lessen + quick-win templates
├── ci/                          ← GitHub Actions (security-scan, quality-monitor, Dependabot)
├── templates/                   ← herbruikbare bestanden (o.a. llms.txt)
├── core/                        ← ALTIJD, elk project
│   ├── SECURITY_AUDITOR.md       security/privacy/compliance auditor (tiered)
│   ├── GO_LIVE_CHECKLIST.md      wat moet kloppen vóór live → GO/GO-MITS/NO-GO
│   ├── AI_RULES.md               regels voor coding agents + product-LLM's
│   ├── ANTI_AI_WRITING.md        content die klinkt als mens, niet AI
│   ├── ANTI_AI_DESIGN.md         design dat niet op AI-slop lijkt
│   ├── ACCESSIBILITY.md          WCAG 2.2 AA + European Accessibility Act
│   ├── SEO_AEO.md                vindbaar in zoek + AI-antwoorden, conversiegericht
│   ├── SPEED.md                  Core Web Vitals (LCP/INP/CLS)
│   ├── MEASUREMENT.md            meten & conversie (GA4, consent, funnel)
│   └── UX.md                     usability, states, microcopy
├── data/                        ← als het project gebruikersdata opslaat
│   ├── AUTH_AND_RLS.md           authenticatie + autorisatie + RLS
│   ├── AVG.md                    privacy, bewaartermijnen, rechten, verwerkers
│   └── INCIDENT_RESPONSE.md      incident + continuïteit + backup
└── zorg/                        ← alleen bij medische/bijzondere persoonsgegevens (Art. 9 AVG)
    ├── MULTI_TENANT.md           tenant-isolatie + tests
    ├── DATA_BREACH_PLAYBOOK.md   meldplicht, 72u-procedure
    └── PENTEST_PRE_GOLIVE.md     verplichte interne pentest
```

---

## Tier-selector — bepaal bij projectstart

**TIER 1 — Brochure/MKB-site.** Geen login, hooguit contactformulier.
→ gebruik: `core/`
→ voorbeeld: Dierenkliniek Coenen, Optiek Jansen, Eres

**TIER 2 — App met login.** Klantdata, CRM, facturatie, portaal.
→ gebruik: `core/` + `data/`
→ voorbeeld: JMGT-portaal, klantportalen, leadmanagement

**TIER 3 — Medische/bijzondere persoonsgegevens of multi-tenant SaaS.**
→ gebruik: `core/` + `data/` + `zorg/`
→ voorbeeld: EetIdee zorgsoftware, afspraaksysteem met behandelgegevens

Bij twijfel tussen twee tiers: kies de hogere.

---

## Hoe je "triggert" per project

Zet één regel bovenaan je project-instructie (Cowork of Claude Code):

> Dit project is **TIER 2**. Volg `project-standards/core/` en `project-standards/data/`.

Claude leest dan alleen die subset. Geen ruis op een brochure-site, volle rigueur waar het telt.

---

## Volgorde van bouwen en gebruiken

1. `core/` geldt voor elk project. Pas dit standaard toe.
2. `data/` activeer je zodra een project gebruikersdata opslaat.
3. `zorg/` activeer je vóór EetIdee echte zorgdata opslaat. Dit is de enige set waar een externe security review en geteste procedures echt nodig zijn. Een ongetest playbook is schijnzekerheid.

Bouw een tier niet vooruit voor een project dat niet bestaat. Een doc zonder bijbehorend project test je niet, en ongeteste docs verzwakken je in een audit.

---

## Cadans: live blijven, niet alleen live gaan

Veiligheid verloopt. Na go-live houd je het bij via twee lagen: geautomatiseerde GitHub Actions in `ci/` (per PR + wekelijks: dependency-, secret- en quality-scan) en een wekelijkse Cowork-agentronde langs alle facetten. Zie `WEEKLY_MONITOR.md`. Praktische lessen en herbruikbare prompts staan in `cowork-playbook.md`.
