import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Audit-log voor het dashboard: legt vast wie-wat-wanneer deed.
 *
 * De tabel `audit_log` heeft RLS aan met GEEN policies, dus alle lees-/
 * schrijfacties verlopen via kmsAdmin() (service-role). Alleen server-side
 * gebruiken, altijd achter dashAuthed().
 *
 * Loggen faalt bewust stil: een mislukte audit-insert mag de eigenlijke
 * dashboard-actie nooit laten crashen.
 */

export type AuditRegel = {
  id: string;
  actor: string | null;
  actie: string;
  entiteit: string | null;
  entiteit_id: string | null;
  details: unknown;
  created_at: string;
};

export async function logAudit(
  actie: string,
  opties?: {
    entiteit?: string;
    entiteitId?: string;
    details?: Record<string, unknown>;
    actor?: string;
  },
): Promise<void> {
  try {
    const sb = kmsAdmin();
    if (!sb) return;
    await sb.from('audit_log').insert({
      actor: opties?.actor ?? 'dashboard',
      actie,
      entiteit: opties?.entiteit ?? null,
      entiteit_id: opties?.entiteitId ?? null,
      details: opties?.details ?? null,
    });
  } catch {
    // Bewust stil: audit-falen mag de actie nooit blokkeren.
  }
}

export async function listAudit(limiet = 100): Promise<AuditRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('audit_log')
    .select('id, actor, actie, entiteit, entiteit_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limiet);
  return (data as unknown as AuditRegel[]) ?? [];
}
