# UX (usability)

## Doel
ANTI_AI_DESIGN gaat over hóe het eruitziet; dit gaat over of het **werkt**. Slechte usability is een directe conversie- en vertrouwenslek.

## Nielsens 10 heuristieken (kort)
1. **Zichtbaarheid van systeemstatus** — laat altijd zien wat er gebeurt.
2. **Match met de echte wereld** — taal van de gebruiker, geen jargon.
3. **Controle & vrijheid** — duidelijke uitweg, undo, annuleren.
4. **Consistentie & standaarden** — volg platformconventies, verras niet.
5. **Foutpreventie** — voorkom fouten vóór ze gebeuren (bevestiging, slimme defaults).
6. **Herkenning boven herinnering** — toon opties, laat niets onthouden tussen schermen.
7. **Flexibiliteit & efficiëntie** — shortcuts voor power-users, eenvoud voor nieuwe.
8. **Esthetisch & minimalistisch** — geen overbodige info die de essentie verdringt.
9. **Help bij fouten** — foutmeldingen in mensentaal: wat ging mis + hoe op te lossen.
10. **Help & documentatie** — vindbaar wanneer nodig, taakgericht.

## De vaak-vergeten states (waar producten afhaken)
- [ ] **Empty** — eerste keer/geen data: leg uit wat dit is + de volgende actie.
- [ ] **Loading** — skeletons/spinners; nooit bevroren of blanco scherm.
- [ ] **Error** — wat ging mis, wat nu, in mensentaal; behoud ingevulde data.
- [ ] **Success** — bevestig de actie expliciet.
- [ ] **Edge cases** — heel lange namen, 0/1/veel items, trage verbinding, offline.

## Microcopy
- Knoppen beschrijven **actie + uitkomst** ("Account aanmaken", niet "Verzenden").
- Formulieren: duidelijke labels, inline-validatie, uitleg waaróm je iets vraagt.
- Geen "Oeps er ging iets mis" — zeg wat en wat de gebruiker kan doen.

## Mobiel & touch
- [ ] Touch-targets ≥ 44px; voldoende tussenruimte.
- [ ] Belangrijke acties binnen duimbereik; geen hover-afhankelijke functionaliteit.
- [ ] Werkt op kleine schermen zonder horizontaal scrollen.

## Checklist bij go-live
- [ ] 10 heuristieken doorlopen op de kernflow
- [ ] Alle states aanwezig (empty/loading/error/success/edge)
- [ ] Foutmeldingen in mensentaal, data blijft behouden
- [ ] Microcopy actie-gericht
- [ ] Mobiel/touch getest op een echt klein scherm
- [ ] Toegankelijkheid: zie core/ACCESSIBILITY.md (overlapt en is deels wettelijk verplicht)
