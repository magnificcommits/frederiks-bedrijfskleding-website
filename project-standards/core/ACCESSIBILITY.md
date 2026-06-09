# ACCESSIBILITY (toegankelijkheid)

## Doel
Sites die bruikbaar zijn voor iedereen, inclusief mensen met een beperking. Tegelijk compliance met de European Accessibility Act (EAA) waar die van toepassing is.

## Juridische context (kort, ik ben geen jurist)
- De EAA (Richtlijn EU 2019/882) wordt sinds 28 juni 2025 in alle 27 EU-lidstaten gehandhaafd, ook in Nederland.
- Nieuw gepubliceerde digitale content moet sinds 28 juni 2025 voldoen. Bestaande content heeft tot 28 juni 2030.
- Technische norm: de EAA verwijst via de geharmoniseerde **EN 301 549** naar WCAG. De huidige geharmoniseerde versie (V3.2.1) verwijst formeel naar **WCAG 2.1 niveau AA**. Zeg dus niet "de EAA vereist 2.2": strikt is dat 2.1 AA. **WCAG 2.2 AA** is de aanbevolen, praktische doelstelling (geen breaking changes t.o.v. 2.1) en waarschijnlijk de volgende baseline — mik daarop.
- Scope: vooral e-commerce, consumentendiensten, bankieren, ticketing, telecom. Geldt ook voor niet-EU bedrijven die aan EU-consumenten verkopen.
- Veelgenoemde drempel voor e-commerce: vanaf 10 medewerkers en 2 miljoen euro omzet/balanstotaal. Micro-ondernemingen die diensten leveren zijn vaak vrijgesteld.
- In-scope partijen moeten een publieke toegankelijkheidsverklaring hebben.
- Handhaving is reëel: er lopen al rechtszaken.

**Bepaal per klant of die in scope valt.** Een kleine dierenarts-brochuresite valt waarschijnlijk buiten scope. Een webshop of bestelflow (EetIdee) valt er vermoedelijk in.

## Waarom dit commercieel telt
- Compliance verkleint juridisch risico voor in-scope klanten.
- Het is een verkoopargument: lever "EAA-compliant" als onderscheidende belofte.
- Breder publiek: ongeveer 1 op de 4 volwassenen in Europa leeft met een beperking.

## Baseline: bouw standaard toegankelijk
Op templateniveau kost dit bijna niets en dekt het de meeste eisen. Doe dit altijd, ongeacht scope.
- Tekstcontrast minimaal AA (4.5:1 voor normale tekst).
- Alt-teksten op alle inhoudelijke afbeeldingen.
- Labels op alle formuliervelden.
- Volledige toetsenbordnavigatie, zichtbare focus-states.
- Semantische HTML (echte headings, buttons, landmarks), geen div-soup.
- Taal-attribuut op html (lang="nl").
- Geen autoplay met geluid.
- Skip-link naar hoofdcontent.
- Linkteksten en buttons met betekenis, geen lege of "klik hier".

## WCAG 2.2 AA — de praktische kern (POUR)

**Perceivable** — alt-teksten op betekenisvolle afbeeldingen (lege `alt` voor decoratief); contrast ≥ 4,5:1 normale tekst / ≥ 3:1 grote tekst en UI; info nooit alléén via kleur; ondertiteling/transcript voor video/audio.

**Operable** — volledig toetsenbord-bedienbaar, geen keyboard-traps; zichtbare focus-indicator (en focus niet verborgen, 2.2); touch-targets ≥ 24px (44px aanbevolen); geen functie die alléén op hover/drag werkt zonder alternatief (2.2).

**Understandable** — `<html lang>` gezet, logische leesvolgorde; consistente, voorspelbare navigatie; formulierfouten duidelijk benoemd + hoe te herstellen; geen onnodig herhaald invoeren (2.2 "Redundant Entry").

**Robust** — semantische HTML, correcte ARIA waar nodig (geen ARIA over kapotte HTML); werkt met screenreaders, status-updates aangekondigd (`aria-live` waar passend).

## Hoe testen
- **Automatisch** (vangt ~30-40%): axe DevTools, Lighthouse, WAVE/Pa11y in CI.
- **Handmatig** (de rest): kernflow alléén met toetsenbord; screenreader aan (VoiceOver/NVDA); contrast checken; zoom naar 200%.
- Automatische tools alleen zijn **niet** voldoende voor conformiteit — combineer altijd met handmatig.

## Per-project
- [ ] Scope bepaald (in/out EAA, micro-uitzondering?)
- [ ] Baseline + WCAG 2.2 AA-kern (POUR) toegepast
- [ ] Automatische scan schoon + handmatige toetsenbord-/screenreader-check
- [ ] Indien in-scope: toegankelijkheidsverklaring gepubliceerd (wat voldoet, bekende beperkingen, contact)
- [ ] Indien twijfel over scope of risico: juridisch laten checken
