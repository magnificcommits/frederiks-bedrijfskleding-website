# DATA BREACH PLAYBOOK

Voor Tier 3: medische of bijzondere persoonsgegevens (Art. 9 AVG). Dit is de zwaarste categorie. Ik ben geen jurist; laat dit valideren.

## Waarom apart
Bij bijzondere persoonsgegevens (gezondheid, behandelgegevens) zijn de gevolgen van een lek en de meldplicht zwaarder. De boetes en aansprakelijkheid zijn reëel.

## Meldplicht (kern)
- Een datalek met risico voor betrokkenen meld je binnen 72 uur na ontdekking bij de Autoriteit Persoonsgegevens.
- Bij hoog risico informeer je ook de betrokkenen zelf.
- Houd een intern register bij van alle datalekken, ook de niet-meldplichtige.

## Stappen bij een lek
1. **Detecteer en stop:** isoleer het systeem, roteer secrets, blokkeer toegang.
2. **Beoordeel binnen uren:** welke gegevens, hoeveel betrokkenen, gezondheidsdata ja/nee, risico-inschatting.
3. **Documenteer:** tijdlijn, oorzaak, omvang, genomen maatregelen. Start meteen, niet achteraf.
4. **Meld:** binnen 72 uur bij de AP indien meldplichtig. Bij twijfel: melden.
5. **Informeer betrokkenen** bij hoog risico, in begrijpelijke taal.
6. **Herstel en voorkom herhaling.**
7. **Evalueer** en pas de standaard aan.

## Vooraf inrichten
- [ ] Verwerkersovereenkomsten met alle partijen die zorgdata raken
- [ ] Rolverdeling en contactpersonen vastgelegd
- [ ] Datalekregister aangemaakt
- [ ] 72-uurs proces bekend bij betrokkenen
- [ ] Externe security review uitgevoerd vóór livegang met echte zorgdata

## Escalatie-contacten (vooraf invullen)

| Rol | Naam | Bereikbaar (tel/mail) | Wanneer inschakelen |
|---|---|---|---|
| Verantwoordelijke project | | | direct bij elk vermoeden |
| Privacyjurist / DPO | | | bij hoog risico / twijfel meldplicht |
| AP — meldloket datalekken | autoriteitpersoonsgegevens.nl | (online formulier) | binnen 72u indien meldplichtig |
| Verwerker(s) (Supabase/Vercel/…) | | | als het lek bij een verwerker zit |

## Datalekregister (art. 33.5 — altijd invullen, ook bij niet-gemelde lekken)

| Datum bewust | Feiten (wat gebeurde) | Soort data (bijzondere cat.?) | Aantal betrokkenen | Gevolgen/effecten | Gemeld AP? (datum) | Betrokkenen geïnformeerd? | Maatregelen (herstel + preventie) | Status |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Notificatie aan betrokkenen (art. 34 — sjabloon, duidelijke taal)

> Beste [naam/aanhef],
>
> Op [datum] is er een beveiligingsincident geweest waarbij [korte omschrijving] mogelijk uw gegevens
> zijn geraakt. Het ging om: [welke gegevens].
>
> **Wat dit voor u kan betekenen:** [gevolgen / risico].
> **Wat wij hebben gedaan:** [genomen maatregelen].
> **Wat u zelf kunt doen:** [bv. wachtwoord wijzigen, alert blijven op verdachte mail].
>
> Vragen? Neem contact op via [contactpunt]. Onze excuses voor het ongemak.

---

**Belangrijk:** een ongetest playbook is schijnzekerheid. Oefen het scenario minstens één keer vóór livegang.
