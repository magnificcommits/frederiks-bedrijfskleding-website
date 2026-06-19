-- Audit-log: wie deed wat, wanneer (dashboard-acties).
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text,
  actie text not null,
  entiteit text,
  entiteit_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table audit_log enable row level security;
create index if not exists idx_audit_log_created on audit_log(created_at desc);
