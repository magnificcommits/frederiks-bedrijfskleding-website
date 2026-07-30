# PRODUCTVISIE & PLATFORMSTRATEGIE — [Projectnaam]

> Kopieer naar `docs/PRODUCT_EN_PLATFORM.md` in het project. Alleen nodig bij een eigen product of platform — niet bij klantwebsites.
> Dit is het leidende document voor **waarom** iets gebouwd wordt. Techniek staat in `core/ARCHITECTURE_AND_API.md`, feiten in `PROJECT-HANDBOEK.md`. Verdubbel niets.

---

## 1. Positionering (één alinea, overal identiek)

`[Product]` is geen `[wat men denkt dat het is: losse app/tool]`.

`[Product]` is `[wat het werkelijk is: de datalaag/infrastructuur van X]`.

Gebruik exact deze formulering in README, pitch, website en documentatie. Eén positionering, letterlijk hergebruikt — anders drift de betekenis per plek.

## 2. Deelnemers en wat ieder brengt

Een platform is pas een platform als deelnemers waarde toevoegen voor elkaar. Vul in wie meedoet, wat ze halen én wat ze brengen. Een rij die alleen haalt, is een klant; dat is niet fout, maar geen netwerkeffect.

| Deelnemer | Wat hij haalt | Welke data/waarde hij toevoegt |
|---|---|---|
| `[eindgebruiker/consument]` | | |
| `[vakman/professional]` | | |
| `[leverancier/groothandel]` | | |
| `[fabrikant/merk]` | | |
| `[toekomstige partner]` | | |

## 3. De centrale datalaag

Welke data is het hart van het platform — het deel dat bij vertrek van elke integratie overblijft en waardevol blijft?

`[bijv. de onderhoudsstaat en -historie van objecten per adres]`

- **Wie is eigenaar** van deze data en wat mag ermee (`data/AVG.md`): `[...]`
- **Wat maakt hem beter** bij meer gebruik: `[...]`
- **Waarom is dit niet triviaal te kopiëren**: `[...]`

Zonder helder antwoord op de laatste vraag is er geen platform, alleen software.

## 4. Platformlaag versus verticaal

Wat is generiek (elke verticaal gebruikt het) en wat is specifiek? Verkeerd inschatten kost later een refactor of, erger, drie kopieën van dezelfde logica.

| Platformlaag (generiek) | Verticaal-specifiek |
|---|---|
| `[auth, tenants, objecten, media, notificaties, audit]` | `[branche-terminologie, onderhoudsintervallen, prijslogica]` |

**Regel:** een tweede verticaal is een nieuwe configuratie/preset op dezelfde engine, geen tweede codebase (`GOLDEN_TEMPLATE_SETUP.md`).

## 5. Feature-toets (vóór je begint te bouwen)

Elke feature langs deze zeven vragen. Meerdere keren "nee" → niet bouwen, of eerst herontwerpen.

1. Versterkt dit de centrale datalaag?
2. Vergroot dit het netwerkeffect (wordt het beter voor bestaande deelnemers)?
3. Is dit herbruikbaar voor meer dan één verticaal of klant?
4. Hoort dit in de platformlaag of in een verticaal — en zit het daar nu?
5. Is dit veilig te bouwen binnen de bestaande autorisatie/RLS?
6. Is dit schaalbaar zonder nieuwe techniek (`ARCHITECTURE_AND_API.md` §2)?
7. Is dit de eenvoudigste goede oplossing, of de leukste?

Bij twijfel over 1 en 2: het is een losse feature. Die mag, maar noem het geen platformstap.

## 6. Roadmapprincipes

- **Eén verticaal eerst, echt af.** Een tweede verticaal vóór de eerste geld oplevert, verdubbelt onderhoud zonder bewijs.
- **Bouw niets voor een deelnemer die er niet is.** Geen partner-API zonder partner, geen fabrikantenmodule zonder fabrikant (`ARCHITECTURE_AND_API.md` §5).
- **Voorbereiden is gratis, bouwen niet.** `tenant_id` en een schone servicelaag vanaf dag één; een event bus pas bij de tweede consumer.
- **Elke afwijking van deze principes** is een ADR (`templates/ADR.md`), geen losse beslissing in een chat.

## 7. Wat dit product níét is

Expliciet begrenzen voorkomt scope creep en verkeerde verwachtingen bij klanten en investeerders.

- `[niet: een boekhoudpakket]`
- `[niet: een marketplace met transacties]`
- `[niet: ...]`
