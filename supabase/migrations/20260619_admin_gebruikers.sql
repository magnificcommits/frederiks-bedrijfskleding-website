-- Admin-accounts voor het dashboard (naast het bestaande wachtwoord, additief).
create table if not exists admin_gebruikers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  naam text,
  rol text not null default 'medewerker',  -- eigenaar | medewerker | lezer
  actief boolean not null default true,
  created_at timestamptz not null default now()
);
alter table admin_gebruikers enable row level security;

insert into admin_gebruikers (email, naam, rol)
  values ('tim.sebastiaan.dejong@gmail.com', 'Tim', 'eigenaar')
  on conflict (email) do nothing;
