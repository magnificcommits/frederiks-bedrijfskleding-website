# Frederiks Bedrijfskleding — website

Vernieuwde website met leadgeneratie voor Frederiks Bedrijfskleding (Hengelo Gld).
**Tier 1** brochure + leadgen. Stack: Next.js 15 + Tailwind 3 + Resend + Zod, gehost op Vercel.

Onderzoek & strategie: zie `../Frederiks Bedrijfskleding/01-onderzoek-en-strategie.md`.

## Lokaal draaien
```bash
npm install
cp .env.example .env.local   # vul waarden in (mag leeg voor eerste run)
npm run dev                  # http://localhost:3000
```

De site draait ook zonder ingevulde env-vars; het formulier verstuurt dan
geen e-mail (handig voor preview).

## Scripts
- `npm run dev` — ontwikkelserver
- `npm run build` / `npm start` — productiebuild
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint (next)

## Structuur
```
app/                routes (App Router)
  api/lead/         advies-/offerteformulier endpoint (Resend + Zod + honeypot)
  branches/[slug]/  branchepagina's (SEO/leadgen)
  regio/[plaats]/   lokale landingspagina's (SEO)
components/         herbruikbare UI (Hero, LeadForm, Reviews, CtaBand, ...)
content/            single source of truth: site, branches, plaatsen, reviews
lib/                env, email (Resend), ratelimit, jsonld
project-standards/  het "orkest" — security/SEO/UX/AVG-standaarden
```

## Inhoud aanpassen (zonder code)
- Bedrijfsgegevens, openingstijden, merken → `content/site.ts`
- Branches + teksten + FAQ → `content/branches.ts`
- Plaatsen (lokale SEO) → `content/plaatsen.ts`
- Reviews → `content/reviews.ts`

## Naar live (kort)
1. Repo naar GitHub, import in Vercel.
2. Env-vars uit `.env.example` zetten (Resend-domein verifiëren).
3. Definitief logo + favicon plaatsen; merkkleuren in `tailwind.config.ts` fijnregelen.
4. Cookie-consent + `NEXT_PUBLIC_GA_ID` koppelen (zie `project-standards/core/MEASUREMENT.md`).
5. `project-standards/core/GO_LIVE_CHECKLIST.md` aflopen → GO / GO-MITS / NO-GO.
6. Domein koppelen.

## Nog te doen / fase 2
- Echte foto's (showroom, Jessi, bedrukte kleding in het veld) en logo.
- Google Business Profile + reviews actief verzamelen.
- Optioneel (Tier 2): persoonlijke klant-bestelpagina met login → activeer dan `project-standards/data/`.
