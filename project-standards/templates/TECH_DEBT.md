# TECHNISCHE SCHULD — register

> Kopieer naar `docs/TECH_DEBT.md` in het project. Doel: bewust uitgestelde keuzes zichtbaar houden, zodat ze een besluit blijven en geen verrassing worden.

**Regel:** een shortcut nemen mag. Een shortcut nemen zonder hem op te schrijven niet. Wie iets bewust half doet, zet het hier neer met eigenaar en trigger.

**Wat hier niet in hoort:** securityrisico's (die gaan naar `RISICOREGISTER.md` en blokkeren een livegang), bugs (issues), en wensen (roadmap). Dit register gaat over code, architectuur en tests die goed genoeg zijn voor nu maar niet houdbaar op termijn.

## Register

| # | Wat | Waar | Waarom uitgesteld | Gevolg als het blijft | Trigger om het op te lossen | Eigenaar | Datum |
|---|---|---|---|---|---|---|---|
| 1 | `[bijv. geen queue, mail wordt synchroon verstuurd]` | `[bestand/laag]` | `[volume nu 5/dag]` | `[timeouts bij piek]` | `[>100/dag of eerste timeout]` | `[naam]` | `[YYYY-MM-DD]` |
| 2 | | | | | | | |

**Trigger is het belangrijkste veld.** "Later oplossen" gebeurt nooit; "oplossen zodra er een tweede tenant bijkomt" of "zodra deze query >500ms duurt" wel. Een regel zonder meetbare trigger is een regel die je over twee jaar nog leest.

## Cadans

- **Bij elke PR die dit raakt:** trigger gehaald? Dan hoort het opgelost te worden of opnieuw besloten, niet stilzwijgend verlengd.
- **Wekelijks** (`WEEKLY_MONITOR.md`): staat er iets waarvan de trigger is gehaald?
- **Vóór livegang** (`core/GO_LIVE_CHECKLIST.md`): geen enkele regel in dit register mag een openstaand security- of dataverliesrisico zijn. Zo ja → verplaatsen naar `RISICOREGISTER.md` en wegen in het GO/NO-GO-verdict.

## Opgelost

| # | Wat | Opgelost op | Hoe |
|---|---|---|---|
| | | | |
