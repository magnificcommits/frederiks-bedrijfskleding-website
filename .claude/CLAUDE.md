# Frederiks Bedrijfskleding — projectregel

Dit project is **TIER 1** (brochure + leadgeneratie, geen login/klantdata).
Volg `project-standards/core/`.

> Activeer `project-standards/data/` zodra er een klant-/bestelportaal met
> login of opgeslagen klantdata bijkomt (dan wordt dit TIER 2).

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 3
- Resend + Zod voor het advies-/offerteformulier (`app/api/lead/route.ts`)
- Content in TS-bestanden onder `content/` (single source of truth)
- Hosting: Vercel

## Doel & richting (zie ../Frederiks Bedrijfskleding/01-onderzoek-en-strategie.md)
- Positionering: **persoonlijk advies, passen op locatie en lokale aanwezigheid**
  (niet concurreren op webshop/voorraad).
- Conversiekern: één heldere "vraag advies/offerte aan"-flow.
- SEO/AEO-motor: branchepagina's (`/branches/[slug]`) + lokale pagina's
  (`/regio/[plaats]`), JSON-LD, FAQ.
- Focusregio: Achterhoek.

## Conventies
- Merkkleuren in `tailwind.config.ts` (ink / steel / amber) — vervang door
  definitief logo/palet zodra beschikbaar.
- Alle bedrijfsgegevens (NAP) in `content/site.ts`.
- Volg `core/ANTI_AI_WRITING.md` en `core/ANTI_AI_DESIGN.md`: menselijke,
  concrete tekst; geen generieke AI-look.
- Vóór livegang: `core/GO_LIVE_CHECKLIST.md` + `core/SEO_AEO.md` +
  `core/ACCESSIBILITY.md` + `core/MEASUREMENT.md`.
