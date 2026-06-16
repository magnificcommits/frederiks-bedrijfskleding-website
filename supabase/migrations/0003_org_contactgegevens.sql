-- Contactgegevens per klant (organisatie): telefoon en adres.
alter table public.organisaties
  add column if not exists telefoon text,
  add column if not exists adres text,
  add column if not exists postcode text;
