# ANTI-AI DESIGN

## Doel
Sites en interfaces die niet op AI-slop lijken. Elk project moet eruitzien als dít merk, niet als de gemiddelde template.

## Waarom dit commercieel telt
- Generiek design is geen smaakkwestie maar een omzetprobleem. Een site die op alle andere lijkt, is onzichtbaar en converteert niet.
- Het faalt op Know, Like en Trust: het ziet er niet uit als jou, het mist persoonlijkheid, en in B2B signaleert het lage inzet. Geen unieke site = twijfel aan een uniek product.
- De markt verzuipt in AI-uitgerolde sites. Merkidentiteit is wat een bezochte site onderscheidt van een onthouden site.

## De AI-tells (vermijd deze standaard)
- Indigo en paarse gradients als hoofdkleur.
- Overal afgeronde hoeken in dezelfde radius.
- Default fonts zonder persoonlijkheid: Inter, Roboto.
- De standaard shadcn/ui-look ongewijzigd overgenomen.
- Frosted glass en gradient-blobs in de hero.
- Perfect symmetrische, voorspelbare SaaS-secties in vaste volgorde (hero, drie kaarten, logo's, CTA).
- Stockfoto's in plaats van echte merkfotografie.
- Emoji als designelement.

## De fix: spec vóór prompt, niet beter prompten
Betere prompts verbeteren hooguit de structuur. Een LLM is geen merkontwerper en mist het oog voor nuance en gevoel. Eindeloos prompts tweaken levert afnemend rendement. Wat wel werkt:

1. **Schrijf een merkspecificatie als contextlaag**, voordat je iets prompt of bouwt. Dit is infrastructuur, geen losse prompt. Alles wordt erop gebouwd.
2. **Werk met een motief, niet met bijvoeglijke naamwoorden.** "Modern" en "clean" geven je ieders versie van modern. Een motief beschrijft het gevoel, de inspiratie en de sfeer. Voorbeeld: "Ontwerp rond het motief van een ambachtelijke werkplaats: degelijk, eerlijk, geen poespas."
3. **Kies één distinctief font** dat bij het merk past, niet de veilige default.
4. **Gebruik echte fotografie**, geen stock.
5. **Voeg bewuste micro-interacties toe** die bij het merk passen, niet de standaard hover-fade.

## Craft mag de basis niet slopen
"Ambacht" is geen vrijbrief voor zware sites. Laat custom fonts, animaties en beeld de **Core Web Vitals niet breken** (zie core/SPEED.md): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. En respecteer `prefers-reduced-motion` — schakel bewegende effecten uit voor wie daarom vraagt (toegankelijkheid, zie core/ACCESSIBILITY.md).

## Per-project merkspec (invullen vóór je bouwt)
- Merkpersoonlijkheid in 3 woorden:
- Motief (het gevoel/de wereld waarin het design leeft):
- Inspiratiebronnen (2-3 sites of merken, geen concurrenten-clones):
- Kleuren (geen indigo-default; kies uit de huisstijl):
- Typografie (1 distinctief font + 1 leesbaar font):
- Beeld (welke echte foto's, welke sfeer):
- Expliciet vermijden:

## Check: ruikt dit naar AI?
- [ ] Geen indigo/paars gradient als default
- [ ] Geen Inter/Roboto zonder reden
- [ ] Niet de kale shadcn-look
- [ ] Echte foto's, geen stock
- [ ] Sectievolgorde wijkt af van de standaard SaaS-template
- [ ] Zou deze site herkenbaar zijn zónder logo? Zo nee: herontwerp.
- [ ] Distinctief font aanwezig
