## Projectstandaarden (lees dit eerst)

Dit project is **TIER 1** — brochure en leadgeneratie. LET OP: er bestaan al routes app/portaal, app/dashboard en app/kledingbeheer plus 21 Supabase-migraties. Verifieer of die live en met echte klantdata werken; zo ja, is dit TIER 2 en geldt data/ ook.
Volg `project-standards/core/`.

@project-standards/WERKWIJZE.md

**Hertoets de tier zodra:** het portaal of dashboard met echte klantdata in gebruik is — dan TIER 2.

---

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

## Database-beveiliging (Supabase, vaste regel)
Elke nieuwe tabel krijgt in dezelfde migratie ALTER TABLE ... ENABLE ROW LEVEL SECURITY. Views krijgen security_invoker = true. Na elke migratie draai je de beveiligingsadviseur van Supabase en los je ERROR en WARN op voordat je verder gaat.

Aanvullend, uit de controle van 14 okt 2026:
- Hulpfuncties voor RLS-policies (current_org, current_rol, current_medewerker_id) staan in het schema `private`, niet in `public`. Nieuwe hulpfuncties ook daar, met EXECUTE alleen voor authenticated en service_role.
- Tabellen zonder policy zijn bedoeld: het KMS leest en schrijft ze alleen op de server met de servicesleutel (kmsAdmin). Het klantportaal gebruikt de sessie van de klant en raakt alleen tabellen met een policy per organisatie.
- Bewust open gelaten: pg_net staat in `public` (verplaatsen kan alleen met DROP; geen objecten in public) en de bucket `media` is publiek (productfoto's; drukproeven en logo's alleen via link met willekeurige naam).
