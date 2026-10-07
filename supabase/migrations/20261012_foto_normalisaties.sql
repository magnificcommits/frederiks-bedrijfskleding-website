-- Gelijkgetrokken productfoto's: welke originele foto door welke versie is vervangen.
-- Zo is elke vervanging terug te draaien en wordt een foto nooit twee keer bewerkt.
create table if not exists public.foto_normalisaties (
  bron_url    text primary key,
  url         text not null,
  methode     text not null,
  teruggezet  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists foto_normalisaties_url_idx on public.foto_normalisaties (url);
alter table public.foto_normalisaties enable row level security;
