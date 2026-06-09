# SEO & AEO

## Doel
Gevonden worden in zoekmachines én in AI-antwoorden (ChatGPT, Perplexity, Google AI Overviews). Conversie boven verkeer.

## Kernregel
Verkeer zonder conversie is ijdelheid. Optimaliseer voor de bezoeker die actie onderneemt, niet voor het aantal bezoekers. Denk in funnels, niet in pageviews.

## On-page SEO (per pagina)
- Eén duidelijke title (50-60 tekens) met de zoekterm vooraan.
- Meta description die klik uitlokt, geen samenvatting (~150-160 tekens; geen ranking-factor, wél doorklik).
- Eén H1, logische heading-structuur daaronder.
- Interne links naar relevante pagina's.
- JSON-LD schema markup: Organization, LocalBusiness, FAQpage, Article waar passend.
- Sitemap.xml en robots.txt correct.
- Hreflang alleen bij meertalige sites (wederkerig, met `x-default`).
- Snelle laadtijd (zie core/SPEED.md, Core Web Vitals).

## Technische SEO (checklist)
- [ ] Canonical op elke pagina; www/non-www en trailing-slash opgelost.
- [ ] `sitemap.xml` + `robots.txt` via framework-conventie (in Next: `sitemap.ts`/`robots.ts`).
- [ ] Open Graph + Twitter/X-cards; OG-afbeelding aanwezig.
- [ ] Mobile-first (Google indexeert de mobiele weergave), HTTPS, schone indexeerbaarheid (geen per ongeluk `noindex`, juiste statuscodes).
- [ ] Structured data valideren met Google's Rich Results Test.
- [ ] Search Console op dag één gekoppeld (veld-data, dekking, zoektermen).

## AEO (answer engine optimization)
AI-antwoordmachines citeren content die een vraag direct en citeerbaar beantwoordt.
- Beantwoord de vraag in de eerste twee zinnen, dan de uitwerking.
- FAQ-secties met echte vragen, voorzien van FAQ-schema.
- Gestructureerde, scanbare content met duidelijke koppen.
- EEAT-signalen: zichtbare auteur, aantoonbare ervaring, bronnen.
- Citeerbare feiten: concrete cijfers, jaartallen, definities.

## llms.txt — nice-to-have, geen ranking-winst
Een Markdown-bestand op `/llms.txt` (spec: llmstxt.org) dat je site samenvat voor LLM's. **Geen SEO- of ranking-voordeel**: zoek-/antwoord-crawlers negeren het grotendeels en Google heeft expliciet gezegd het niet te gebruiken. Wél nuttig voor developer-/agent-tooling (Cursor, Claude Code, Copilot, MCP). Goedkoop te leveren, maar verwacht er geen vindbaarheidswinst van. Template: `templates/llms.txt`.

## Content die rankt
Door mensen geschreven content presteert beter dan AI-content op betrokkenheid en conversie, en zoekmachines belonen echte expertise. Volg daarom ANTI_AI_WRITING.md. Google straft content niet af omdat het door AI is gemaakt — het oordeelt op nut en kwaliteit; wat wél wordt afgestraft is "scaled content abuse" (massaal pagina's maken om rankings te manipuleren). Generieke AI-tekst is een SEO-nadeel, geen versneller.

## Linkbuilding (kort, ethisch)
Backlinks blijven een sterk signaal, maar de winst zit in kwaliteit en relevantie, niet volume.
- **Werkt**: digital PR (eigen data/onderzoek, expert-reacties op actualiteit), HARO-achtige bronvermelding (HARO heet nu **Connectively**; ook Qwoted, Featured.com), echt linkbare assets (tools, datasets, definitieve gidsen).
- **Vermijden** (Google link-spam-policy): links kopen/verkopen, PBN's, link-farms, exact-match-anchor-schema's. Betaalde links dragen `rel="sponsored"` of `nofollow`.
- Meet op kwaliteit en relevantie, niet op aantal links. Eén gezaghebbende, relevante link verslaat tientallen lage-kwaliteitslinks.

## Conversie
- Eén primaire CTA per pagina, expliciet en actiegericht.
- Bewijs dichtbij de CTA: reviews, cases, garanties.
- Verwijder frictie: korte formulieren, duidelijke vervolgstap.
- Meet of dit werkt: funnel + key events, zie core/MEASUREMENT.md.

## Checklist
- [ ] Title + meta per pagina
- [ ] Heading-structuur klopt
- [ ] Schema markup aanwezig
- [ ] Sitemap + robots.txt
- [ ] FAQ met schema waar relevant
- [ ] Content menselijk geschreven (ANTI_AI_WRITING)
- [ ] Eén heldere CTA per pagina
- [ ] Core Web Vitals groen
