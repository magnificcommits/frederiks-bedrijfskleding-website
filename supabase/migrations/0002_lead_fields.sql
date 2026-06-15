-- Extra velden voor het lead-dashboard: offertewaarde (pipelinewaarde) en een vrije notitie.
alter table public.leads add column if not exists offertewaarde numeric;
alter table public.leads add column if not exists notitie text;
