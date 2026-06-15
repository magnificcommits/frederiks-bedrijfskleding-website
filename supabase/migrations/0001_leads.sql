-- Leadtabel voor Frederiks Bedrijfskleding.
-- Draai dit in de Supabase SQL-editor (of via de CLI) na het aanmaken van het project.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  company     text,
  email       text not null,
  phone       text,
  branche     text,
  aantal      text,
  bericht     text,
  bron        text,
  status      text not null default 'nieuw'  -- nieuw | offerte | geaccordeerd | afgewezen
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- Veiligheid: RLS aan, geen publieke policies. Alleen de service-role key
-- (server-side, bypasst RLS) heeft toegang. De anon-key kan niets.
alter table public.leads enable row level security;
