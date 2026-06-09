# MULTI-TENANT ISOLATIE

Voor Tier 3: SaaS of zorgsoftware met meerdere klanten of organisaties.

## Principe
Geen enkele tenant mag ooit data van een andere tenant zien, wijzigen of verwijderen. Dit is de belangrijkste en gevaarlijkste eis van multi-tenant.

## Maatregelen
- Elke data-tabel heeft een `tenant_id` (of `organization_id`).
- RLS-policies filteren op tenant via de geauthenticeerde context, niet via client-input.
- Storage: bestanden gescheiden per tenant, policies controleren tenant-eigenaarschap.
- Zoeken, rapportages en exports respecteren tenant-grenzen. Let op aggregaties die per ongeluk over tenants heen lopen.
- Caching mag nooit tenant-data delen. Cache-keys bevatten tenant-context.
- Achtergrondtaken en webhooks dragen tenant-context mee.

## Tests (verplicht, herhaalbaar)
- [ ] Tenant A kan data van B niet lezen (lijst, detail, zoeken)
- [ ] Tenant A kan data van B niet muteren of verwijderen
- [ ] Tenant A komt niet in rapportages of exports van B
- [ ] Storage van B is niet bereikbaar voor A
- [ ] Geforceerde ID's in API-calls leveren geen cross-tenant toegang
- [ ] Cache lekt geen tenant-data

Maak deze tests onderdeel van CI, niet eenmalig. Een nieuwe feature die tenant-isolatie breekt, mag de build laten falen.
