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
