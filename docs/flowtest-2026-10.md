# Flowtest kernprocessen KMS en klantportaal (oktober 2026)

Doel: de kernflows van begin tot eind nalopen op logica en volgorde. Wat ontbreekt,
wat klopt niet, welke stap is onlogisch, welke controle mist en welke status
verspringt verkeerd. Getest met code-review en SQL-controles op de echte database
(`ldbyljadqququzoicyid`). Deze omgeving kan supabase.co niet bereiken, dus de
browserchecklist onderaan moet nog live worden afgewerkt.

Ernst: **hoog** = verkeerd geld, dubbel bestellen of data die wegvalt. **middel** =
onlogische stap, verkeerde status of handwerk dat niet nodig is. **laag** = cosmetisch
of randgeval.

Migratie: `supabase/migrations/20261006_flow_koppelingen.sql` (toegepast op de
database). Voegt `orders.offerte_id` en `voorraad_mutaties.order_id` toe en koppelt
bestaande orders "Aangemaakt uit offerte #…" alsnog aan hun offerte.

---

## Het statusmodel in één oogopslag

| Module | Statussen | Wie zet hem |
| --- | --- | --- |
| Offerte | concept → verstuurd → geaccepteerd / afgewezen | Jessi; mailen zet verstuurd; Omzetten naar order zet geaccepteerd |
| Order | concept → nog bestellen → besteld → deels binnen → alles binnen → bedrukken/borduren → verpakken → bezorgen/verzonden → factureren → afgerond. Uitstap: **geannuleerd** | Jessi (knop Volgende stap), inkoop (ontvangst), werkbon (productie), factuur (betaald) |
| Goedkeuring order | niet nodig / wacht → goedgekeurd / afgewezen | leidinggevende in portaal of Jessi |
| Werkbon | wacht op drukproef → goedgekeurd → in productie → klaar | drukproef (alle akkoord), Jessi |
| Drukproef | concept → verstuurd → goedgekeurd / afgekeurd | Jessi; klant via portaal of link |
| Inkoopregel | te bestellen → besteld → deels → geleverd. Uitstap: **geannuleerd** | inkoop |
| Factuur | concept → verzonden → betaald | Jessi, mailen, Moneybird-sync |

Nieuw: `geannuleerd` bestond al in het portaal (afgewezen bestelling) maar niet in het
KMS. Daardoor toonde de statuskeuze op de orderpagina "concept" bij een afgewezen
order, en kon "Factureer alle" hem factureren. Hij staat nu overal in het model.

---

## Flow 1. Nieuwe klant → afdelingen → werknemers → maten → assortiment → portaaltoegang

**Stappen:** Klanten > Nieuwe klant (wizard: gegevens, contactpersonen, afdelingen,
werknemers, portaal) → klantkaart tabbladen Afdelingen, Werknemers (maten/pasdag),
Assortiment → Gebruikers: E-mail koppelen.

| # | Probleem | Ernst | Status |
| --- | --- | --- | --- |
| 1.1 | Een nieuwe portaalgebruiker kreeg geen uitnodiging. Hij wist niet dat hij kon inloggen of waar. | middel | **Opgelost**: uitnodigingsmail met de inloglink, vanuit de wizard en vanuit E-mail koppelen (vinkje, standaard aan). |
| 1.2 | E-mail koppelen op de klantkaart maakte dubbele rijen en koppelde een adres dat al bij een andere klant inlogt (portaal weet dan niet welke klant het moet tonen). De wizard deed dit wel goed. | middel | **Opgelost**: zelfde controle als de wizard, met een melding op het tabblad. |
| 1.3 | E-mail koppelen gaf geen enkele terugmelding. | laag | **Opgelost**. |
| 1.4 | 3 van de 6 portaalgebruikers hangen niet aan een werknemer. Die zien in de webshop een keuzelijst "voor wie bestel je" en hebben geen eigen budget. | middel | Open: data, Jessi koppelt ze in het portaal of de klantkaart. |

## Flow 2. Lead → offerte → order → werkbon → levering → factuur → betaling → Moneybird

**Stappen:** Lead > Maak offerte → regels/korting/kleur → Mail naar klant (verstuurd) →
klant mailt akkoord → Omzetten naar order → Volgende stap … → Maak factuur → mailen
(verzonden) → betaald (handmatig of Moneybird-sync).

| # | Probleem | Ernst | Status |
| --- | --- | --- | --- |
| 2.1 | **Dubbel bestellen bij de leverancier.** Bij goedkeuren van een order ging er een bestelmail met álle regels naar de leverancier (ook wat op voorraad lag), terwijl de inkoopregels op "te bestellen" bleven. Via Inkoop werd daarna alles nog een keer besteld. | hoog | **Opgelost**: de directe bestelmail is weg; bestellen bij de leverancier gaat alleen via Inkoop. |
| 2.2 | "Omzetten naar order" twee keer klikken (of terugknop) maakte twee orders. Er was geen koppeling order → offerte. | hoog | **Opgelost**: `orders.offerte_id`; een tweede klik opent de bestaande order. De offerte toont "Van deze offerte is order #… gemaakt" en de knop wordt "Naar order". |
| 2.3 | Korting werd per stuk afgerond: 100 × €19,95 met 15% is op de offerte €1.695,75, op order en factuur €1.696,00. | middel | **Opgelost**: nettostukprijs met 4 decimalen; de factuur rondt per regel af, regelbedrag gelijk aan de offerte. Moneybird krijgt bij een afrondingsverschil één regel met het exacte bedrag (bestond al). |
| 2.4 | Btw van de offerte (bijv. 0% buitenland) ging verloren: de factuur nam de btw van het artikel (21%). | middel | **Opgelost**: factuur van een order uit een offerte neemt de btw van de offerte. |
| 2.5 | Offerteregel met 150% korting of negatief aantal kon worden opgeslagen (negatieve regel). | middel | **Opgelost**: korting 0-100, aantal ≥ 0, met melding. Een negatieve stukprijs mag (kortingsregel). |
| 2.6 | Een offerte zonder regels kon gemaild en omgezet worden (lege order). | middel | **Opgelost**. Regels met aantal 0 gaan niet mee naar de order (ze tellen ook niet in het offertetotaal). |
| 2.7 | Contactpersoon van de offerte moest op de order opnieuw als aanvrager gekozen worden. | laag | **Opgelost**: gaat mee als "Aangevraagd door". |
| 2.8 | Lead bleef op "afspraak" na versturen offerte en op "offerte" na akkoord. | middel | **Opgelost**: offerte verstuurd → lead "offerte" (vanuit nieuw/contact/afspraak); geaccepteerd → lead gewonnen. Afgewezen laat de lead staan (vaak volgt een tweede offerte, en verloren vraagt een reden). |
| 2.9 | Offertestatus accepteerde elke tekst uit het formulier. | laag | **Opgelost**: alleen de vier statussen. Na "geaccepteerd" wijst een melding naar Omzetten naar order. |
| 2.10 | Orderstatus: één keuzelijst met 14 statussen, geen volgende stap. Dezelfde status opnieuw opslaan stuurde de klant een mail. | middel | **Opgelost**: knop "Volgende stap: …", leesbare labels, zelfde status = niets doen en geen mail. Status wordt gecontroleerd. |
| 2.11 | Annuleren halverwege bestond niet in het KMS. Open inkoop bleef in de werkvoorraad staan. | hoog | **Opgelost**: "Order annuleren" (met bevestiging). Inkoop die nog niet weg is wordt ingetrokken; al bestelde regels worden gemeld ("zeg zelf af"). |
| 2.12 | **"Factureer alle"** factureerde álle orders zonder factuur: ook concept, nog niet geleverd, geannuleerd en orders zonder regels (factuur van €0 met een factuurnummer; zie FR-2026-0003 bij order 1003). | hoog | **Opgelost**: lijst zonder concept/geannuleerd/€0; "Factureer alle" alleen geleverde orders. Losse factuur van een niet-geleverde order kan nog (vooruitbetaling), met label. |
| 2.13 | Factuur van een order kon twee keer worden gemaakt. | middel | **Opgelost**: bestaande factuur wordt teruggegeven. Ook geen factuur meer van een order zonder regels of een geannuleerde order. |
| 2.14 | Regels van een verzonden, betaalde of al in Moneybird staande factuur konden nog gewijzigd worden; een doorgezette factuur kon terug naar concept. KMS en boekhouding lopen dan uiteen. | hoog | **Opgelost**: regels alleen bij concept; terug naar concept geblokkeerd als hij in Moneybird staat. |
| 2.15 | Orderregels wijzigen na een verstuurde factuur of op een afgeronde/geannuleerde order. | middel | **Opgelost**: geblokkeerd met uitleg. Verwijderen van een orderregel trekt de bijbehorende open inkoopregel in. |
| 2.16 | Factuur betaald zette de order niet op afgerond. | middel | **Opgelost**: betaald (ook via Moneybird-sync) zet een geleverde order op afgerond. Een order die nog in productie is (vooruitbetaling) blijft staan. |
| 2.17 | "Maak factuur" stond ook bij concept- en €0-orders, maar de factuurpagina toonde die order dan niet. | laag | **Opgelost**: link alleen bij factureerbare orders. |
| 2.18 | Ordertotaal kon zwevende-komma-resten hebben (89.50000001). | laag | **Opgelost**: per regel op centen, net als de factuur. |
| 2.19 | Klantakkoord op een offerte gaat via een mailto-knop; Jessi zet daarna zelf de status. Er is geen akkoordpagina met token zoals bij drukproeven. | middel | Open: voorstel, akkoordpagina `/offerte/[token]` die de offerte op geaccepteerd zet en Jessi een taak geeft. |
| 2.20 | Factuurnummer wordt al bij het concept vergeven. Een verwijderd concept laat een gat in de nummering. | middel | Open: nummer pas toekennen bij definitief maken (raakt Moneybird-koppeling, apart oppakken). |
| 2.21 | Data: order 1002 staat op goedkeuring "wacht" maar status "nog bestellen", en heeft al een verzonden factuur. | laag | Open: demo-data, handmatig rechtzetten. |

## Flow 3. Portaal: bestellen binnen budget → goedkeuren → order → status → retour/ruil/reparatie → klacht

| # | Probleem | Ernst | Status |
| --- | --- | --- | --- |
| 3.1 | Afgewezen en geannuleerde bestellingen bleven budget verbruiken. | hoog | **Opgelost**: tellen niet meer mee in de budgetcheck. |
| 3.2 | Het team-overzicht (Medewerkers) toonde verbruik uit de oude tabel `portaal_bestellingen`, terwijl de webshop op de orders blokkeert. Beheerder zag een ander bedrag dan waarop geblokkeerd werd. | middel | **Opgelost**: zelfde rekenwijze als de webshop. |
| 3.3 | Goedkeuren in het portaal kon een order die al beslist was (oud tabblad, dubbele klik) opnieuw beslissen, ook een order in productie annuleren. | hoog | **Opgelost**: alleen orders die op "wacht" staan; anders een melding (NL/EN/DE/PL). |
| 3.4 | Goedkeuren in het portaal maakte geen inkoopregels; goedkeuren in het KMS wel. Afwijzen in het KMS zette de order niet op geannuleerd; in het portaal wel. | middel | **Opgelost**: beide wegen doen hetzelfde (goedgekeurd → nog bestellen + inkoopregels; afgewezen → geannuleerd + inkoop intrekken; terug naar wacht → concept). |
| 3.5 | Bestelling zonder goedkeuringsstap: status "nog bestellen" maar geen inkoopregels; Jessi moest zelf op Genereer inkoopregels klikken. | middel | **Opgelost**: inkoopregels meteen. Ligt alles op voorraad, dan gaat de order direct naar "alles binnen". |
| 3.6 | Mislukte opslag van de regels liet een order zonder regels achter. | laag | **Opgelost**: lege order wordt opgeruimd. |
| 3.7 | Pakketbestelling: artikelen op €0, pakketprijs alleen op de order. Factuur werd €0; een regel toevoegen in het KMS zette het ordertotaal op €0. | hoog | **Opgelost**: factuur krijgt een regel met de pakketprijs; ordertotaal blijft staan. |
| 3.8 | Pakketbestelling telt niet mee in het budget-verbruik (regels op €0). | middel | Open: vraagt een kolom "telt voor budget" op de order (buiten-budget-pakketten mogen juist niet tellen). |
| 3.9 | "Altijd gratis"-artikelen tellen bij een volgende bestelling wel mee in het verbruik (alleen de check bij het plaatsen rekent ze gratis). | middel | Open: zelfde oplossing als 3.8. |
| 3.10 | Retour verwerkt boekt niets terug in de voorraad; creditfactuur zet budget niet terug. | laag | Open: bewust handwerk (bedrukte kleding is vaak niet opnieuw te verkopen). |

## Flow 4. Drukproef → klant beslist (portaal of link) → werkbon/order

| # | Probleem | Ernst | Status |
| --- | --- | --- | --- |
| 4.1 | Eén goedgekeurde proef zette de order al naar borduren, ook als de rugbedrukking nog bij de klant lag. | hoog | **Opgelost**: pas als er voor die order geen proef meer open staat. |
| 4.2 | Een goedkeuring zette een order die nog op de leverancier wachtte (nog bestellen, besteld, deels binnen) al op "borduren". De werkbon zegt juist "kan op de machine zodra de kleding binnen is". | middel | **Opgelost**: werkbon gaat op goedgekeurd; de order gaat alleen door als alles binnen is, anders start de productie via de werkbon. |
| 4.3 | Portaal toonde conceptproeven (nog in de maak) en liet de klant die goedkeuren. | middel | **Opgelost**: klant ziet alleen verstuurde en beslist proeven. |
| 4.4 | Portaal kon een al beslist proef omgooien (goedgekeurd → afgekeurd terwijl hij al op de machine ligt). | hoog | **Opgelost**: alleen proeven op "verstuurd". |
| 4.5 | Jessi kreeg geen bericht bij een beslissing in het portaal (wel via de link). | middel | **Opgelost**: mail naar het meldadres. |
| 4.6 | De link in de mail mag ook een conceptproef beslissen. | laag | Open: bewust gelaten, de link gaat alleen mee met versturen. |

## Flow 5. Inkoop/voorraad

| # | Probleem | Ernst | Status |
| --- | --- | --- | --- |
| 5.1 | Inkoopregels keken naar de voorraad op de plank, niet naar wat andere open orders al claimden. Twee orders zagen dezelfde vijf jassen en geen van beide bestelde bij. | hoog | **Opgelost**: beschikbaar = plank min claims van andere open orders (min wat voor die orders al besteld is). |
| 5.2 | De voorraad ging nooit omlaag bij uitlevering (alleen bij tellen). Na verzenden verviel de reservering, dus het artikel leek weer op voorraad. | hoog | **Opgelost**: bij bezorgen/verzonden/factureren/afgerond wordt van de plank afgeboekt wat niet speciaal is ingekocht (mutatie "verkoop", één keer per order). |
| 5.3 | Vrije regels (borduurkosten, instelkosten, pakketprijs) werden als "te bestellen" bij een leverancier gezet. | middel | **Opgelost**: alleen regels met een artikel. |
| 5.4 | Een geannuleerde order hield zijn inkoopregels in de werkvoorraad. | hoog | **Opgelost** (zie 2.11). |
| 5.5 | Status heen en weer (verzonden → verpakken) boekt de voorraad niet terug. | laag | Open: zeldzaam; corrigeer via een telling. |

## Flow 6. Sparen

| # | Probleem | Ernst | Status |
| --- | --- | --- | --- |
| 6.1 | Punten tellen orders vanaf "nog bestellen". Doordat afgewezen orders nu ook in het KMS op geannuleerd gaan, worden hun punten teruggeboekt (grootboek kende geannuleerd al). | middel | **Opgelost** via 3.4. |
| 6.2 | Twee gelijktijdige aanvragen kunnen samen meer punten inwisselen dan het saldo. | laag | Open. |
| 6.3 | Spaarkorting komt op de nieuwste conceptfactuur met 21% btw, ook als die factuur 0% heeft. | laag | Open. |

## Flow 7. Campagnes, nieuwsbrief, brieven

Alleen op hoofdlijnen gelezen (afmeldlijst, testmodus, tracking bestaan). Geen
wijzigingen in deze ronde; zie checklist.

---

## Checklist voor de browser (live afwerken)

Gebruik een testklant. Vink af wat klopt; noteer ordernummers.

**Flow 1**
- [ ] Klantkaart > Gebruikers > E-mail koppelen met een nieuw adres, vinkje aan: melding "heeft toegang en heeft een uitnodiging gekregen"; mail komt binnen met link naar /portaal/login.
- [ ] Zelfde adres nog een keer koppelen: melding "had al toegang", geen tweede rij.
- [ ] Adres dat bij een andere klant inlogt: melding "kan al inloggen bij een andere klant".
- [ ] Wizard Nieuwe klant met portaaltoegang voor een contactpersoon: uitnodiging komt binnen.

**Flow 2**
- [ ] Offerte: regel met korting 150 → rode melding, niet opgeslagen. Aantal -1 → melding.
- [ ] Offerte zonder regels mailen → melding "nog geen regels".
- [ ] Offerte vanaf een lead mailen: lead staat daarna op "offerte".
- [ ] 100 × €19,95, 15% korting, btw 21%: offertetotaal noteren → Omzetten naar order → ordertotaal €1.695,75 → factuur excl. €1.695,75.
- [ ] Offerte met btw 0% → order → factuur: regels op 0% btw.
- [ ] Omzetten naar order twee keer (terugknop, nog een keer klikken): komt op dezelfde order, geen tweede. Offerte toont "Naar order #…". Lead staat op gewonnen.
- [ ] Order: knop "Volgende stap" loopt van concept tot afgerond. Dezelfde status opslaan → melding "stond al op deze status", besteller krijgt geen mail.
- [ ] Order annuleren met een open inkoopregel: melding met aantal ingetrokken; regel staat niet meer in Inkoop > te bestellen.
- [ ] Facturen > Factuur van order: geen concept-, geannuleerde of €0-orders in de lijst; niet-geleverde orders met label. "Factureer alle" telt alleen geleverde orders.
- [ ] Factuur mailen (verzonden) → regel wijzigen of toevoegen: geblokkeerd met uitleg. Terug naar concept → weer bewerkbaar.
- [ ] Factuur in Moneybird doorgezet → terug naar concept: "status kon niet worden gewijzigd".
- [ ] Factuur op betaald → order staat op afgerond.
- [ ] Order met verzonden factuur: regel toevoegen/verwijderen niet meer zichtbaar.

**Flow 3**
- [ ] Portaal, klant met goedkeuring: bestelling plaatsen → leidinggevende keurt goed → order in KMS op "nog bestellen" met inkoopregels (of "alles binnen" als alles op voorraad ligt). Er gaat géén bestelmail naar de leverancier.
- [ ] Zelfde bestelling in een tweede tabblad nog eens afwijzen → melding "al beslist".
- [ ] Afgewezen bestelling: resterend budget in de webshop is weer het oude bedrag; Medewerkers-overzicht toont hetzelfde verbruik.
- [ ] Klant zonder goedkeuring: bestelling → inkoopregels staan meteen klaar.
- [ ] Pakket bestellen → factuur van die order heeft een regel met de pakketprijs.
- [ ] Order in KMS goedkeuren / afwijzen via het blok Goedkeuring: status volgt (nog bestellen / geannuleerd).

**Flow 4**
- [ ] Conceptproef is niet zichtbaar in het portaal; na "versturen" wel.
- [ ] Order met twee proeven (borst, rug): eerste goedkeuren → werkbon blijft "wacht op drukproef"; tweede goedkeuren → werkbon "goedgekeurd".
- [ ] Order op "besteld" + alle proeven goed → order blijft "besteld"; na ontvangst alles binnen → werkbon op in productie zet de order op borduren/bedrukken.
- [ ] Order op "alles binnen" + laatste proef goed → order direct op borduren/bedrukken.
- [ ] Beslissing in het portaal → mail naar het meldadres. Nog een keer beslissen (oud tabblad) → er verandert niets.

**Flow 5**
- [ ] Voorraadartikel met 5 op de plank. Order A (5 stuks) goedkeuren → geen inkoop. Order B (3 stuks) goedkeuren → inkoopregel voor 3.
- [ ] Order A op verzonden → Voorraad toont 0 op de plank, mutatie "verkoop" met "Uitgeleverd met order #…". Nog een keer op verzonden zetten (eerst terug) → geen tweede afboeking.
- [ ] Order met een vrije regel "Borduurkosten" → Genereer inkoopregels maakt daarvoor geen inkoopregel.

**Flow 6**
- [ ] Order met punten afwijzen → punten verdwijnen bij het volgende openen van Sparen.

**Flow 7**
- [ ] Campagne in testmodus versturen naar eigen adres; afmeldlink werkt; klik verschijnt bij tracking.
