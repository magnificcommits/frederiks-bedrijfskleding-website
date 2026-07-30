# DATA- EN AI-KWALITEIT

`AI_RULES.md` gaat over **veilig** werken met AI (coding agents en product-LLM's). Dit document gaat over **betrouwbaar**: wat je gebruikers voorschotelt als feit, aanname of schatting.

Alleen van toepassing als het product data verzamelt, verrijkt of AI-output aan gebruikers toont. Anders overslaan en dat benoemen.

---

## 1. Herkomst per gegeven

Elk gegeven dat je toont, heeft een herkomst. Leg per veld (of per tabel) vast welke van de vier het is:

| Herkomst | Voorbeeld | Mag je op vertrouwen |
|---|---|---|
| **Opgegeven** door de gebruiker | bouwjaar, adres, materiaal | ja, maar valideerbaar fout |
| **Gemeten / geverifieerd** uit een bron | openbaar register, factuur, sensor | ja, met bronvermelding |
| **Afgeleid** door berekening/regel | interval op basis van materiaal + jaar | ja, mits de regel uitlegbaar is |
| **Geschat** door AI of model | herkenning op foto, classificatie | **nee, tot een mens bevestigt** |

Sla de herkomst op in de database (bijv. `source`, `confidence`, `verified_at`, `verified_by`), niet alleen in de UI. Zonder kolom is het na één release niet meer te reconstrueren — en kun je nooit meer onderscheiden wat een klant zelf zei van wat jij hebt gegokt.

---

## 2. Betrouwbaarheid tonen, niet verbergen

- **Nooit een schatting presenteren als feit.** Geen absolute datum of prijs waar een marge hoort.
- **Drie niveaus is genoeg**: bevestigd · waarschijnlijk · schatting. Percentages suggereren precisie die je niet hebt.
- **Toon de reden**, niet alleen de uitkomst: "verwacht onderhoud in 2027 — op basis van bouwjaar 1998 en houten kozijnen" slaat "2027" met factor tien.
- **Eén klik naar de aanname.** De gebruiker moet kunnen zien waaróp iets is gebaseerd en dat kunnen corrigeren.
- **Correctie is waardevolle data.** Wie een aanname verbetert, verbetert het model én de dataset. Sla de correctie op, overschrijf de originele waarde niet stil.

## 3. AI-output naar gebruikers

- [ ] **Mens bevestigt vóór het feit wordt.** AI-herkenning vult een voorstel in; een gebruiker of beheerder keurt goed. Pas dan `verified`.
- [ ] **Nooit automatisch een onomkeerbare of financiële actie** op alleen modeloutput (bestellen, factureren, verwijderen, mailen naar klanten).
- [ ] **Fallback is expliciet.** Faalt het model of is de zekerheid laag: zeg "niet bepaald" en toon de handmatige route. Nooit een verzonnen waarde als vangnet.
- [ ] **Uitlegbaar in mensentaal.** Eén regel waarom, in de taal van de gebruiker (`UX.md`, microcopy).
- [ ] **Zichtbaar dat het AI is** waar dat niet overduidelijk is — en dat is per augustus 2026 ook een transparantieplicht (`AI_RULES.md`, EU AI Act art. 50).
- [ ] **Kosten begrensd** per gebruiker en per dag, met alerting (`AI_RULES.md`, LLM10).

## 4. Datakwaliteit onderhouden

Kwaliteit verloopt zonder dat iemand het merkt. Meet daarom een paar signalen en zet ze in de wekelijkse ronde (`WEEKLY_MONITOR.md`):

- **Volledigheid** — percentage records met de velden die je nodig hebt voor de kernfunctie.
- **Versheid** — hoe oud is de laatste update per record; wanneer wordt iets "verouderd".
- **Correctiegraad** — hoe vaak corrigeren gebruikers een AI-voorstel. Stijgt dit, dan is het model of de regel slechter geworden.
- **Weigergraad** — hoe vaak valt het systeem terug op "niet bepaald".
- **Duplicaten** — dezelfde entiteit twee keer is een stille datakiller.

Definieer per veld wat "ongeldig" is en blokkeer dat bij invoer (Zod + DB-constraint), niet met een schoonmaakscript achteraf.

## 5. Evaluatie van AI-functionaliteit

Een AI-feature zonder evaluatieset is niet onderhoudbaar: je kunt niet zien of een promptwijziging het beter of slechter maakte.

- [ ] **Vaste evaluatieset** van 20-50 echte gevallen met het juiste antwoord erbij, in de repo (zonder persoonsgegevens).
- [ ] **Bij elke prompt-, model- of regelwijziging** de set opnieuw draaien en de uitkomst vergelijken. Verslechtering = niet mergen.
- [ ] **Prompts in versiebeheer**, niet in een dashboard of los document. Een prompt is code.
- [ ] **Log input, output en gebruikerscorrectie** (zonder onnodige persoonsgegevens) zodat je fouten kunt terugvinden.
- [ ] **Modelwissel is een besluit**, geen instelling: ADR met reden en evaluatie-uitkomst.

## 6. Privacy

Datakwaliteit rechtvaardigt geen extra dataverzameling. Verzamel wat de functie nodig heeft en niets meer (`data/AVG.md`): grondslag per verwerking, bewaartermijn per soort, geen persoonsgegevens in prompts of logs die er niet horen, en een verwerkersovereenkomst met elke AI-provider.

## 7. Checklist bij een nieuwe data- of AI-feature

- [ ] Herkomst per veld vastgelegd in het datamodel, niet alleen in de UI
- [ ] Betrouwbaarheidsniveau zichtbaar voor de gebruiker + reden erbij
- [ ] Menselijke bevestiging vóór iets als feit of actie geldt
- [ ] Fallbackgedrag gedefinieerd en getest
- [ ] Evaluatieset aanwezig en gedraaid
- [ ] Kosten- en rate-limits actief
- [ ] Grondslag, bewaartermijn en verwerkersovereenkomst gecontroleerd
