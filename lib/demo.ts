import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

/**
 * De centrale demo-omgeving. Eén demoklant (organisaties.is_demo) met drie vaste
 * logins. Jessi opent de demo vanuit het KMS met één klik: de server logt de
 * portaalsessie in als het gekozen demo-account, zonder mail of code. Wisselen kan
 * alleen tussen deze drie adressen; een demo-account ziet door RLS nooit andere klanten.
 */
export const DEMO_ACCOUNTS = {
  beheerder: 'info+beheerder@frederiksbedrijfskleding.nl',
  leidinggevende: 'info+leidinggevende@frederiksbedrijfskleding.nl',
  medewerker: 'info+medewerker@frederiksbedrijfskleding.nl',
} as const;

export type DemoRol = keyof typeof DEMO_ACCOUNTS;

export const DEMO_LABEL: Record<DemoRol, string> = {
  beheerder: 'Werkgever',
  leidinggevende: 'Leidinggevende',
  medewerker: 'Werknemer',
};

/** Wat je in de demo kunt kiezen. Leidinggevende ziet vrijwel hetzelfde als werkgever, dus die laten we weg. */
export const DEMO_ROLLEN: DemoRol[] = ['beheerder', 'medewerker'];

export function isDemoRol(v: unknown): v is DemoRol {
  return typeof v === 'string' && (DEMO_ROLLEN as string[]).includes(v);
}

export function demoRolVanEmail(email: string | null | undefined): DemoRol | null {
  const e = (email ?? '').toLowerCase();
  return DEMO_ROLLEN.find((r) => DEMO_ACCOUNTS[r] === e) ?? null;
}

/** E-mail van de huidige portaalsessie (of null). */
export async function portaalEmail(): Promise<string | null> {
  const sb = await getServerSupabase('portaal');
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.email?.toLowerCase() ?? null;
}

/** Mag deze bezoeker de demo openen of wisselen? KMS-login, of al in de demo. */
export async function magDemo(): Promise<boolean> {
  if (await dashAuthed()) return true;
  return demoRolVanEmail(await portaalEmail()) !== null;
}

/** Logt de portaalsessie in als het demo-account voor deze rol. */
export async function logInAlsDemo(rol: DemoRol): Promise<{ ok: true } | { ok: false; fout: string }> {
  const admin = kmsAdmin();
  const portaal = await getServerSupabase('portaal');
  if (!admin || !portaal) return { ok: false, fout: 'Database niet geconfigureerd.' };
  const email = DEMO_ACCOUNTS[rol];

  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) {
    // Het account bestaat nog niet in Supabase Auth: eerst aanmaken (bevestigd, zonder mail).
    await admin.auth.admin.createUser({ email, email_confirm: true });
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  }
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return { ok: false, fout: 'Kon geen demo-sessie maken.' };

  const { error } = await portaal.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error) return { ok: false, fout: 'Kon de demo-sessie niet openen.' };
  return { ok: true };
}

/** Zet de demoklant terug in de begintoestand (supabase/migrations/20261008_demo_omgeving.sql). */
export async function resetDemo(): Promise<boolean> {
  const admin = kmsAdmin();
  if (!admin) return false;
  const { error } = await admin.rpc('demo_reset');
  return !error;
}

/**
 * Is de demo leeg of nog de oude voorbeeldklant? Dan eerst vullen. Zo staat er bij
 * de eerste keer openen meteen een complete klant klaar.
 */
export async function zorgDemoGevuld(): Promise<void> {
  const admin = kmsAdmin();
  if (!admin) return;
  const { data } = await admin.from('organisaties').select('id, naam').eq('is_demo', true).maybeSingle();
  const org = data as { id: string; naam: string } | null;
  if (!org) return;
  const { count } = await admin.from('medewerkers').select('id', { count: 'exact', head: true }).eq('organisatie_id', org.id);
  if (org.naam !== 'Demo Bouwbedrijf' || (count ?? 0) < 3) await resetDemo();
}
