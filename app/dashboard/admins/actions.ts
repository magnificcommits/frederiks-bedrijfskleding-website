'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { maakAdmin, zetAdminActief, wijzigAdminRol } from '@/lib/kms/adminGebruikers';

/**
 * Guard: vereist een geldige dashboard-sessie EN eigenaar-rechten.
 * Een wachtwoord-login zonder admin-account telt als eigenaar (zodat Tim met
 * het wachtwoord ook beheer kan doen).
 */
async function eigenaarGuard(): Promise<boolean> {
  if (!(await dashAuthed())) return false;
  const huidige = await getHuidigeAdmin();
  // Geen admin-account => wachtwoord-login => behandel als eigenaar.
  if (!huidige) return true;
  return huidige.rol === 'eigenaar';
}

export async function adminToevoegen(formData: FormData) {
  if (!(await eigenaarGuard())) redirect('/dashboard/admins?fout=toegang');
  const email = String(formData.get('email') ?? '');
  const naam = String(formData.get('naam') ?? '');
  const rol = String(formData.get('rol') ?? 'medewerker');
  const res = await maakAdmin({ email, naam, rol });
  revalidatePath('/dashboard/admins');
  if (!res.ok) redirect('/dashboard/admins?fout=opslaan');
  redirect('/dashboard/admins');
}

export async function adminActiefZetten(formData: FormData) {
  if (!(await eigenaarGuard())) redirect('/dashboard/admins?fout=toegang');
  const id = String(formData.get('id') ?? '');
  const actief = String(formData.get('actief') ?? '') === 'true';
  await zetAdminActief(id, actief);
  revalidatePath('/dashboard/admins');
  redirect('/dashboard/admins');
}

export async function adminRolWijzigen(formData: FormData) {
  if (!(await eigenaarGuard())) redirect('/dashboard/admins?fout=toegang');
  const id = String(formData.get('id') ?? '');
  const rol = String(formData.get('rol') ?? '');
  await wijzigAdminRol(id, rol);
  revalidatePath('/dashboard/admins');
  redirect('/dashboard/admins');
}
