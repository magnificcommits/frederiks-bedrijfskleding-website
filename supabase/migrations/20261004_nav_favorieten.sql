-- Favorieten in het zijmenu van het dashboard, per beheerder (feedback Tim, 3 okt 2026).
-- Een lijst hrefs in de volgorde waarin ze bovenaan het menu staan, bijv.
-- {'/dashboard','/dashboard/orders'}. NULL betekent: nog niets gekozen, toon de standaardlijst.
-- Een lege lijst betekent: bewust alles weggehaald.
--
-- Alleen toevoegen. Idempotent: mag vaker gedraaid worden.
-- Zolang deze kolom ontbreekt, bewaart het dashboard favorieten in de browser (localStorage).

alter table public.admin_gebruikers
  add column if not exists nav_favorieten text[];

comment on column public.admin_gebruikers.nav_favorieten is
  'Favorieten in het dashboardmenu (hrefs, op volgorde). NULL = standaardlijst.';
