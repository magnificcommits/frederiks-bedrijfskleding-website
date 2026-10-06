import { logAudit } from '@/lib/kms/audit';
import { getMijnToegang } from '@/lib/portaal/team';

/**
 * Legt een handeling in het portaal vast in het logboek (audit_log), bij de klant.
 * Het KMS toont dit op het tabblad Portaal: wie wat wanneer heeft gedaan.
 * Best effort: loggen mag een handeling nooit laten mislukken.
 */
export async function logPortaal(actie: string, details?: Record<string, unknown>): Promise<void> {
  try {
    const t = await getMijnToegang();
    if (!t.email || !t.organisatieId) return;
    await logAudit(`portaal_${actie}`, {
      actor: t.email,
      entiteit: 'organisatie',
      entiteitId: t.organisatieId,
      details: { ...(details ?? {}), rol: t.rol },
    });
  } catch {
    // Loggen is een gemak, geen voorwaarde.
  }
}
