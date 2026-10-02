import { kmsAdmin, getHuidigeAdmin } from '@/lib/kms/adminClient';

/**
 * Audit-log voor het dashboard: legt vast wie-wat-wanneer deed.
 *
 * De tabel `audit_log` heeft RLS aan met GEEN policies, dus alle lees-/
 * schrijfacties verlopen via kmsAdmin() (service-role). Alleen server-side
 * gebruiken, altijd achter dashAuthed().
 *
 * Loggen faalt bewust stil: een mislukte audit-insert mag de eigenlijke
 * dashboard-actie nooit laten crashen.
 *
 * Actor: het e-mailadres van de ingelogde beheerder (eigen account), anders
 * 'dashboard-wachtwoord' (ingelogd met het gedeelde wachtwoord).
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

export type Wijzigingen = Record<string, { van: unknown; naar: unknown }>;

/** Wie voert de actie uit? E-mail van de ingelogde admin, anders het gedeelde wachtwoord. */
export async function huidigeActor(): Promise<string> {
  try {
    const admin = await getHuidigeAdmin();
    if (admin?.email) return admin.email;
  } catch {
    // Geen request-context of geen sessie.
  }
  return 'dashboard-wachtwoord';
}

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
    const actor = opties?.actor ?? (await huidigeActor());
    await sb.from('audit_log').insert({
      actor,
      actie,
      entiteit: opties?.entiteit ?? null,
      entiteit_id: opties?.entiteitId ?? null,
      details: opties?.details ?? null,
    });
  } catch {
    // Bewust stil: audit-falen mag de actie nooit blokkeren.
  }
}

/** Maakt waarden vergelijkbaar: '' en null zijn gelijk, getallen als tekst ('12.50') gelijk aan 12.5. */
function normaliseer(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return t;
  }
  return v;
}

function gelijk(a: unknown, b: unknown): boolean {
  const na = normaliseer(a);
  const nb = normaliseer(b);
  if (na === nb) return true;
  if (typeof na === 'object' || typeof nb === 'object') {
    try {
      return JSON.stringify(na) === JSON.stringify(nb);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Bepaalt welke velden veranderd zijn. Alleen sleutels die in `na` voorkomen
 * (en niet undefined zijn) tellen mee; velden die je niet hebt aangeraakt blijven buiten beeld.
 */
export function berekenWijzigingen(
  voor: Record<string, unknown> | null | undefined,
  na: Record<string, unknown> | null | undefined,
): Wijzigingen {
  const uit: Wijzigingen = {};
  const oud = voor ?? {};
  for (const [veld, nieuw] of Object.entries(na ?? {})) {
    if (nieuw === undefined) continue;
    const vorig = oud[veld];
    if (!gelijk(vorig, nieuw)) uit[veld] = { van: vorig ?? null, naar: nieuw ?? null };
  }
  return uit;
}

/**
 * Logt een wijziging met oude en nieuwe waarden. Slaat alleen de gewijzigde velden op,
 * als details { wijzigingen: { veld: { van, naar } } }. Is er niets veranderd, dan wordt
 * er niets gelogd. `extra` komt naast `wijzigingen` in details (bv. een naam ter herkenning).
 */
export async function logWijziging(
  actie: string,
  opties: {
    entiteit: string;
    entiteitId?: string;
    voor: Record<string, unknown> | null | undefined;
    na: Record<string, unknown> | null | undefined;
    actor?: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const wijzigingen = berekenWijzigingen(opties.voor, opties.na);
    if (Object.keys(wijzigingen).length === 0) return;
    await logAudit(actie, {
      entiteit: opties.entiteit,
      entiteitId: opties.entiteitId,
      actor: opties.actor,
      details: { ...(opties.extra ?? {}), wijzigingen },
    });
  } catch {
    // Bewust stil.
  }
}

export type AuditFilter = { entiteit?: string; actor?: string };

export async function listAudit(limiet = 100, filter: AuditFilter = {}): Promise<AuditRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = sb
    .from('audit_log')
    .select('id, actor, actie, entiteit, entiteit_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limiet);
  if (filter.entiteit) q = q.eq('entiteit', filter.entiteit);
  if (filter.actor) q = q.eq('actor', filter.actor);
  const { data } = await q;
  return (data as unknown as AuditRegel[]) ?? [];
}

/** Unieke entiteiten en actoren uit het recente logboek, voor de filters. */
export async function auditFilterOpties(): Promise<{ entiteiten: string[]; actoren: string[] }> {
  const sb = kmsAdmin();
  if (!sb) return { entiteiten: [], actoren: [] };
  const { data } = await sb
    .from('audit_log')
    .select('entiteit, actor')
    .order('created_at', { ascending: false })
    .limit(2000);
  const rijen = (data as { entiteit: string | null; actor: string | null }[] | null) ?? [];
  const entiteiten = Array.from(new Set(rijen.map((r) => r.entiteit).filter((x): x is string => !!x))).sort();
  const actoren = Array.from(new Set(rijen.map((r) => r.actor).filter((x): x is string => !!x))).sort();
  return { entiteiten, actoren };
}
