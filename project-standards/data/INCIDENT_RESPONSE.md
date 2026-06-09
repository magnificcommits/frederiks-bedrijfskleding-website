# INCIDENT RESPONSE

Voor Tier 2+ projecten. Wat te doen bij een beveiligingsincident of storing.

## Voorbereiding (vooraf inrichten)
- Monitoring en alerting aan (Sentry, Vercel, Supabase).
- Backups draaien en zijn aantoonbaar herstelbaar (test de restore, niet alleen de backup).
- Eén verantwoordelijke aangewezen per project.
- Toegang tot logs en dashboards geregeld.

## Ernst & escalatie
Bepaal als eerste de ernst — dat stuurt tempo en wie je inschakelt:
- **Laag:** beperkte storing, geen data geraakt → eigen verantwoordelijke handelt af.
- **Middel:** functionaliteit uit of niet-gevoelige data geraakt → verantwoordelijke + klant informeren.
- **Hoog/kritiek:** persoonsgegevens of bijzondere categorieën geraakt, of platform plat → direct escaleren, en bij een (vermoedelijk) datalek de 72-uursklok starten (zie DATA_BREACH_PLAYBOOK / AP-meldplicht).

## Bij een incident
1. **Stabiliseer:** stop de schade. Roteer gelekte secrets direct, blokkeer misbruikte toegang.
2. **Beoordeel:** wat is geraakt? Zijn er persoonsgegevens betrokken? Bepaal de ernst (zie boven).
3. **Documenteer:** tijdlijn, oorzaak, impact, genomen acties.
4. **Herstel:** fix de oorzaak, niet alleen het symptoom. Restore uit backup indien nodig.
5. **Datalek?** Zie DATA_BREACH_PLAYBOOK (Tier 3) of beoordeel meldplicht bij de Autoriteit Persoonsgegevens.
6. **Leer:** noteer wat misging en welke preventie volgt.

## Communicatie
- Eén woordvoerder; voorkom tegenstrijdige berichten.
- Bij middel+ ernst informeert de verantwoordelijke de klant: wat is er gebeurd, wat is de impact, wat doen we, wanneer volgt een update.
- Bij hoog risico voor betrokkenen: zie de informatieplicht in DATA_BREACH_PLAYBOOK (art. 34).

## Continuïteit (RTO/RPO)
- **RPO** (Recovery Point Objective) — hoeveel dataverlies is acceptabel? Dit bepaalt de **backupfrequentie**.
- **RTO** (Recovery Time Objective) — hoe snel moet je terug zijn? Dit bepaalt de **herstelaanpak** (warm restore, rollback, etc.).
- Restore-procedure beschreven en getest — test de restore, niet alleen de backup.
- Rollback-plan; deploy omkeerbaar.
- Kritieke afhankelijkheden (Supabase, Vercel) en hun statuspagina's bekend.

## Weerbaarheid (vooraf)
- **WAF / bot-mitigatie** op publieke endpoints (Vercel/Cloudflare-laag) tegen scraping/brute force/DDoS.
- **Budget-alerts** op cloud-, DB- en AI-kosten — een aanval die kosten opdrijft (denial-of-wallet) zie je dan vroeg.

## Checklist (vooraf)
- [ ] Monitoring + alerting aan
- [ ] Backups draaien en restore getest
- [ ] Verantwoordelijke aangewezen
- [ ] Secret-rotatie geoefend
- [ ] RTO/RPO bepaald
- [ ] WAF/bot-mitigatie + budget-alerts aan
