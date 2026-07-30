# ADR-NNNN — [Korte titel van het besluit]

> Kopieer naar `docs/decisions/NNNN-korte-titel.md`. Eén pagina, één besluit.
> Een ADR wijzig je niet. Achterhaald? Zet de status op `Vervangen door ADR-NNNN` en schrijf een nieuwe.

| Veld | Waarde |
|---|---|
| Datum | `[YYYY-MM-DD]` |
| Status | `Voorgesteld / Geaccepteerd / Vervangen door ADR-NNNN / Verworpen` |
| Besloten door | `[naam]` |
| Raakt | `[architectuur / database / auth / API / hosting / stack / proces]` |

## Context

Welk probleem of welke vraag ligt er, en waarom nu? Feiten en meetbare aanleiding, geen wensdenken. Wat is de huidige situatie en waar loopt die tegenaan.

## Besluit

Wat gaan we doen, in één of twee zinnen. Actief geformuleerd: "we gebruiken X voor Y".

## Alternatieven

| Optie | Waarom niet gekozen |
|---|---|
| `[niets doen / huidige oplossing houden]` | |
| `[alternatief A]` | |
| `[alternatief B]` | |

"Niets doen" hoort er altijd bij te staan. Als dat niet is afgewogen, is het besluit niet af.

## Toets (bij nieuwe technologie — `core/ARCHITECTURE_AND_API.md` §2)

- Concreet probleem, met meting of incident: `[...]`
- Waarom de huidige oplossing tekortschiet: `[...]`
- Meerwaarde tegen extra complexiteit; wie onderhoudt dit over een jaar: `[...]`
- Past bij deze fase (gebruikers, omzet, teamgrootte nu): `[...]`

## Gevolgen

**Goed:** `[wat wordt hierdoor makkelijker]`

**Kosten:** `[wat wordt moeilijker, duurder of complexer — wees eerlijk]`

**Security/privacy-impact:** `[nieuw risico, of "geen" met reden]` → DEEP AUDIT nodig? `[ja/nee]`

**Migratie / terugdraaien:** `[hoe kom je hier weer vanaf, en tot wanneer is dat realistisch]`

## Vervolg

- [ ] `PROJECT-HANDBOEK.md` bijgewerkt (secties: `[...]`)
- [ ] Tests aangepast of toegevoegd
- [ ] Eventuele technische schuld genoteerd in `templates/TECH_DEBT.md`
