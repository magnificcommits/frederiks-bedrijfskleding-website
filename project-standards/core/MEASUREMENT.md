# MEASUREMENT (meten & conversie)

## Doel
Je kunt niet verbeteren wat je niet meet. Security/SEO/speed voorkomen risico; meting laat zien wat geld oplevert. Zet dit op dag één op, niet achteraf.

## Wat meten (begin klein)
- **Eén north-star metric** per project — het getal dat echt succes weergeeft (betalende klanten, afgeronde boekingen, gekwalificeerde leads). Niet pageviews.
- **De funnel ernaartoe** — de 3-5 stappen van bezoek → conversie. Meet waar mensen afhaken.
- **Acquisitie** — welke kanalen leveren de conversies (niet alleen het verkeer).

Meet outcomes (conversies, omzet), niet alleen activiteit (clicks, views).

## GA4 — basis
GA4 is event-gebaseerd. Sinds 2024 heten "conversions" in GA4 **"key events"** (elk event dat je als belangrijk markeert); "conversions" is nu de Google Ads-zijde.
- Definieer events voor je funnelstappen; markeer de beslissende als **key event**.
- Bouw de funnel via het Funnel exploration-rapport.
- Koppel Google Search Console aan GA4 voor de SEO-kant (zie core/SEO_AEO.md).

## Consent Mode v2 — en het verschil met de AVG
Let op het onderscheid:
- **Consent Mode v2** is een **Google-product-eis** (verplicht sinds 6 maart 2024 voor EER-verkeer dat Google Ads-/analytics-features gebruikt). Het geeft het toestemmingssignaal door aan Google-tags.
- De **juridische** plicht om vooraf toestemming te vragen komt uit ePrivacy + AVG (zie data/AVG.md). Een **CMP** (consent-management-platform) verzamelt die toestemming. Consent Mode is dus niet hetzelfde als de wettelijke consent — een CMP vervult die.

De vier consent-parameters:

| Parameter | Stuurt |
|---|---|
| `ad_storage` | advertentie-cookies |
| `analytics_storage` | analytics-cookies |
| `ad_user_data` | doorgeven user-data aan Google (v2) |
| `ad_personalization` | gepersonaliseerde advertenties (v2) |

## Privacy-vriendelijk alternatief
Geen cookie-consent-last en toch meten? Overweeg cookieloze/privacy-first analytics (Plausible, Fathom, of GA4 in Basic + server-side). Minder granulair, maar vaak genoeg voor north-star + funnel en minder AVG-wrijving. Maak de keuze expliciet per project.

## Checklist bij go-live
- [ ] North-star metric + funnel gedefinieerd en gemeten
- [ ] GA4 (of privacy-first alternatief) actief; key events ingesteld
- [ ] Search Console gekoppeld
- [ ] Bij Google Ads/analytics in de EER: Consent Mode v2 via een CMP, gekoppeld aan de cookie-consent
- [ ] Geen tracking vóór toestemming waar vereist (AVG-grondslag gerespecteerd)
