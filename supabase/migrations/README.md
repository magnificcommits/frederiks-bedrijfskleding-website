# Database-migraties

Vanaf nu gaat **elke** schemawijziging via een migratiebestand in deze map, zodat de
database reproduceerbaar is en wijzigingen reviewbaar zijn.

## Conventie
- Bestandsnaam: `JJJJMMDD_korte_omschrijving.sql` (oplopend).
- Alleen idempotente DDL (`create table if not exists`, `add column if not exists`).
- Nieuwe tabellen: RLS aanzetten (`enable row level security`) en bewust policies toevoegen,
  óf service-role-only laten (geen policies = alleen de service-role client kan erbij).

## Baseline
De bestaande productie-database (golf 1 t/m 17) is de baseline. Een volledige
schema-dump als `0000_baseline.sql` volgt; de bestanden hieronder leggen nieuwe
wijzigingen vanaf golf 18 vast.
