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
├── WERKWIJZE.md                 ← vaste sessieregels, via @-import geladen in CLAUDE.md van elk project
├── GOLDEN_TEMPLATE_SETUP.md     ← agency-orkest: één template, presets, uitrol
├── WEEKLY_MONITOR.md            ← wekelijkse cadans: CI + Cowork-agent
├── LOADTEST_GUIDE.md            ← k6: rooktest (CI) + zware capaciteits-/piektests
├── cowork-playbook.md           ← praktische lessen + quick-win templates
├── ci/                          ← GitHub Actions (ci-verify, security-scan, quality-monitor, loadtest, Dependabot)
├── prompts/                     ← herbruikbare opdrachten
│   └── GOVERNANCE_AUDIT.md       repo + documentatie in overeenstemming met de code brengen
├── templates/                   ← herbruikbare bestanden (llms.txt, SECRET_REGISTER, CLAUDE.md.example,
│                                  ADR, TECH_DEBT, DPIA, RISICOREGISTER, AUDITRAPPORT, PRODUCT_EN_PLATFORM)
├── core/                        ← ALTIJD, elk project
│   ├── SECURITY_AUDITOR.md       security/privacy/compliance auditor (tiered)
│   ├── GO_LIVE_CHECKLIST.md      wat moet kloppen vóór live → GO/GO-MITS/NO-GO
│   ├── ARCHITECTURE_AND_API.md   architectuurregels, techniek toevoegen, API-strategie (Tier 2+)
│   ├── TESTING_AND_DOD.md        Definition of Done, testprioriteit, autorisatiematrix
│   ├── DOC_GOVERNANCE.md         één bron van waarheid per onderwerp + bewijsregel
│   ├── DATA_AND_AI_QUALITY.md    databetrouwbaarheid, AI-output naar gebruikers, evaluatie
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

## Hoe je "triggert" per project — 3 lagen

Losse regels intypen werkt, maar vergeet je. Bouw het in drie lagen zodat het steeds minder van je geheugen afhangt:

**Laag 1 — Minimum (handmatig, per sessie).** Zet één regel bovenaan je project-instructie (Cowork-project of chat):

> Dit project is **TIER 2**. Volg `project-standards/core/` en `project-standards/data/`; DEEP AUDIT bij data-/auth-/route-wijzigingen; GO_LIVE_CHECKLIST vóór deploy.

**Laag 2 — Automatisch (aanbevolen, altijd gelezen).** Kopieer `templates/CLAUDE.md.example` naar `CLAUDE.md` in de **root** van het project en zet de tier goed. Dat bestand laadt via `@project-standards/WERKWIJZE.md` de gedeelde sessieregels, zodat je ze op één plek onderhoudt. Claude Code én Cowork lezen `CLAUDE.md` **automatisch bij elke sessie** — je hoeft niets meer te plakken. Staat dit in je golden template, dan reist het mee bij elke "Use this template", dus élk nieuw project heeft het vanaf commit 1. Dit is het echte antwoord op "altijd naar gekeken".

**Laag 3 — Afgedwongen (de enige harde garantie).** Een agent die markdown leest, is probabilistisch: soms slaat hij het over of interpreteert hij het verkeerd. CI is dat niet. Zet daarom `ci/ci.yml` + branch protection aan (zie `ci/README.md`) zodat onveilige wijzigingen **worden geblokkeerd** ook als niemand — mens of agent — de docs las. Laag 1-2 sturen; laag 3 dwingt af.

Met laag 2 leest Claude alleen de juiste subset: geen ruis op een brochure-site, volle rigueur waar het telt.

---

## Per project: relevantie bepalen (binnen de tier)

De tier bepaalt de **verplichte** set. Beoordeel bij projectstart daarbinnen welke risico's extra spelen en pas de bijbehorende dieptecheck toe. Dit is *aanvullend*, niet om controles weg te strepen:

- **AI-feature** (chatbot/RAG/agent)? → `core/AI_RULES.md` §product-LLM (OWASP LLM Top 10).
- **File uploads**? → upload-validatie + opslagbeleid in `core/SECURITY_AUDITOR.md`.
- **Betalingen / webhooks**? → signature-verificatie + idempotency (SECURITY_AUDITOR §integraties).
- **Multi-tenant** (meerdere klanten/organisaties)? → `zorg/MULTI_TENANT.md`, óók zonder zorgdata.
- **Geen database / statische site**? → sla `data/` over en **benoem dat expliciet**.

**Regel (niet onderhandelbaar):** een control die bij je tier hoort, sla je alleen over met een expliciete, geschreven reden — met eigenaar en datum, zoals een GO-MITS-restrisico (zie `core/GO_LIVE_CHECKLIST.md`). "Voelt niet relevant" is geen reden; zo verdwijnen controles stil. Bij twijfel: toepassen.

---

## Volgorde van bouwen en gebruiken

1. `core/` geldt voor elk project. Pas dit standaard toe.
2. `data/` activeer je zodra een project gebruikersdata opslaat.
3. `zorg/` activeer je vóór EetIdee echte zorgdata opslaat. Dit is de enige set waar een externe security review en geteste procedures echt nodig zijn. Een ongetest playbook is schijnzekerheid.

Bouw een tier niet vooruit voor een project dat niet bestaat. Een doc zonder bijbehorend project test je niet, en ongeteste docs verzwakken je in een audit.

---

## Cadans: live blijven, niet alleen live gaan

Veiligheid verloopt. Na go-live houd je het bij via twee lagen: geautomatiseerde GitHub Actions in `ci/` (per PR + wekelijks: dependency-, secret- en quality-scan) en een wekelijkse Cowork-agentronde langs alle facetten. Zie `WEEKLY_MONITOR.md`. Praktische lessen en herbruikbare prompts staan in `cowork-playbook.md`.

Documentatie verloopt net zo hard. Na een grote bouwronde, vóór een livegang en verder per kwartaal draai je `prompts/GOVERNANCE_AUDIT.md`: die brengt alle `.md`-bestanden weer in overeenstemming met de echte code en config, en houdt `.claude/CLAUDE.md` actueel. De regels waaraan die audit toetst — één leidend document per onderwerp, geen claim zonder bewijs — staan in `core/DOC_GOVERNANCE.md`.
