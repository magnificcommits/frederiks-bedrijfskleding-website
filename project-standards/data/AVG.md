# AVG / GDPR

Voor Tier 2+ projecten die persoonsgegevens verwerken. Ik ben geen jurist; bij twijfel juridisch laten checken.

## Uitgangspunten
- Privacy by design en dataminimalisatie: verzamel alleen wat je nodig hebt.
- Bewaar niet langer dan nodig. Leg bewaartermijnen vast per datatype.
- Verwerk op een grondslag (toestemming, overeenkomst, gerechtvaardigd belang).

## Verplichte procedures
- **Inzage en export:** betrokkene kan zijn data opvragen in leesbaar formaat.
- **Verwijdering:** er is een werkend proces om data van een betrokkene te verwijderen.
- **Toestemming:** waar nodig expliciet, intrekbaar, vastgelegd.
- **Cookies en tracking:** alleen na toestemming (ePrivacy), niet-essentiële cookies standaard uit.
- **Datalekken:** zie INCIDENT_RESPONSE en (Tier 3) DATA_BREACH_PLAYBOOK.

## DPIA / GEB — wanneer verplicht
Een DPIA (Gegevensbeschermingseffectbeoordeling) is verplicht zodra de verwerking "waarschijnlijk een hoog risico" oplevert. Concrete triggers (art. 35.3):
- Grootschalige verwerking van **bijzondere categorieën** (gezondheid, ras, biometrie) of strafrechtelijke gegevens.
- Systematische, uitgebreide **profilering** met rechtsgevolg of vergelijkbaar significant effect.
- **Stelselmatige grootschalige monitoring** van openbaar toegankelijke ruimte.

Check ook de AP **"Lijst verplichte DPIA"** (17 categorieën, niet uitputtend) en de EDPB-richtlijn: voldoe je aan **2 of meer van de 9 criteria**, dan is een DPIA in beginsel nodig. Bij twijfel: doe de zelftoets, en bij hoog risico juridisch/DPO laten toetsen. Sjabloon: `templates/DPIA.md`.

## Verwerkersovereenkomsten
Sluit een verwerkersovereenkomst met elke externe partij die persoonsgegevens verwerkt: Supabase, Vercel, Sentry, Sanity, Resend, analytics. Leg dataregio's vast waar relevant.

## Logging
- Log geen persoonsgegevens, tokens of wachtwoorden.
- Sentry-scrubbing aan: geen PII, headers, cookies, IP's of request bodies onnodig.

## Checklist
- [ ] Bewaartermijnen vastgelegd
- [ ] DPIA-trigger gecheckt → DPIA gedaan indien vereist
- [ ] Inzage/export-proces werkt
- [ ] Verwijderproces werkt
- [ ] Cookiebeleid + banner conform
- [ ] Verwerkersovereenkomsten compleet
- [ ] Privacyverklaring gepubliceerd
- [ ] Geen PII in logs
