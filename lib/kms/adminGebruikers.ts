import { kmsAdmin } from '@/lib/kms/adminClient';

export type AdminGebruiker = {
  id: string;
  email: string;
  naam: string | null;
  rol: string;
  actief: boolean;
  created_at: string;
};

/** Alle beheerders, alfabetisch op e-mail. Lege lijst als de DB niet is gekoppeld. */
export async function listAdmins(): Promise<AdminGebruiker[]> {
  const admin = kmsAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('admin_gebruikers')
    .select('id, email, naam, rol, actief, created_at')
    .order('email', { ascending: true });
  if (error || !data) return [];
  return data as AdminGebruiker[];
}

export async function maakAdmin(input: { email: string; naam?: string | null; rol?: string }): Promise<{ ok: boolean; fout?: string }> {
  const admin = kmsAdmin();
  if (!admin) return { ok: false, fout: 'Database niet gekoppeld.' };
  const email = String(input.email ?? '').toLowerCase().trim();
  if (!email) return { ok: false, fout: 'E-mailadres is verplicht.' };
  const naam = input.naam ? String(input.naam).trim() : null;
  const rol = ['eigenaar', 'medewerker', 'lezer'].includes(String(input.rol)) ? String(input.rol) : 'medewerker';
  const { error } = await admin.from('admin_gebruikers').insert({ email, naam, rol });
  if (error) return { ok: false, fout: error.message };
  return { ok: true };
}

export async function zetAdminActief(id: string, actief: boolean): Promise<{ ok: boolean; fout?: string }> {
  const admin = kmsAdmin();
  if (!admin) return { ok: false, fout: 'Database niet gekoppeld.' };
  if (!id) return { ok: false, fout: 'Onbekende beheerder.' };
  const { error } = await admin.from('admin_gebruikers').update({ actief }).eq('id', id);
  if (error) return { ok: false, fout: error.message };
  return { ok: true };
}

export async function wijzigAdminRol(id: string, rol: string): Promise<{ ok: boolean; fout?: string }> {
  const admin = kmsAdmin();
  if (!admin) return { ok: false, fout: 'Database niet gekoppeld.' };
  if (!id) return { ok: false, fout: 'Onbekende beheerder.' };
  if (!['eigenaar', 'medewerker', 'lezer'].includes(rol)) return { ok: false, fout: 'Onbekende rol.' };
  const { error } = await admin.from('admin_gebruikers').update({ rol }).eq('id', id);
  if (error) return { ok: false, fout: error.message };
  return { ok: true };
}

export async function getAdmin(id: string): Promise<AdminGebruiker | null> {
  const admin = kmsAdmin();
  if (!admin || !id) return null;
  const { data } = await admin
    .from('admin_gebruikers')
    .select('id, email, naam, rol, actief, created_at')
    .eq('id', id)
    .maybeSingle();
  return (data as AdminGebruiker | null) ?? null;
}

/** Supabase-account (id + geverifieerde tweestap-factoren) per e-mailadres, voor het beheerdersoverzicht. */
async function accountsPerEmail(): Promise<Map<string, { userId: string; factorIds: string[] }>> {
  const uit = new Map<string, { userId: string; factorIds: string[] }>();
  const admin = kmsAdmin();
  if (!admin) return uit;
  try {
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data) break;
      for (const u of data.users) {
        const email = u.email?.toLowerCase().trim();
        if (!email) continue;
        const factorIds = (u.factors ?? []).filter((f) => f.status === 'verified').map((f) => f.id);
        uit.set(email, { userId: u.id, factorIds });
      }
      if (data.users.length < 1000) break;
    }
  } catch {
    // Geen overzicht beschikbaar: dan tonen we geen tweestapstatus.
  }
  return uit;
}

/** Per beheerder-e-mailadres: staat tweestapsverificatie aan? Ontbreekt een e-mailadres, dan is de status onbekend. */
export async function tweeStapStatus(): Promise<Record<string, boolean>> {
  const accounts = await accountsPerEmail();
  const uit: Record<string, boolean> = {};
  accounts.forEach((v, email) => {
    uit[email] = v.factorIds.length > 0;
  });
  return uit;
}

/**
 * Zet tweestapsverificatie uit voor een beheerder (bv. telefoon kwijt). Verwijdert alle
 * gekoppelde authenticator-apps van dat account; de beheerder kan daarna opnieuw koppelen.
 */
export async function zetTweeStapUit(email: string): Promise<{ ok: boolean; fout?: string }> {
  const admin = kmsAdmin();
  if (!admin) return { ok: false, fout: 'Database niet gekoppeld.' };
  const account = (await accountsPerEmail()).get(String(email ?? '').toLowerCase().trim());
  if (!account) return { ok: false, fout: 'Geen account gevonden.' };
  for (const id of account.factorIds) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id, userId: account.userId });
    if (error) return { ok: false, fout: error.message };
  }
  return { ok: true };
}
