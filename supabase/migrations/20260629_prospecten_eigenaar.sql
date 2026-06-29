-- Eigenaar (naam van de ondernemer/eigenaar) los van contactpersoon, zodat we bij
-- prospects de eigenaar apart kunnen vastleggen en aanvullen.
alter table public.prospecten add column if not exists eigenaar text;
