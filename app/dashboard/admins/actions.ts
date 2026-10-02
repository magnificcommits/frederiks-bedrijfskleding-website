'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, getHuidigeAdmin, eisEigenaar } from '@/lib/kms/adminClient';
import { maakAdmin, zetAdminActief, wijzigAdminRol, getAdmin, zetTweeStapUit } from '@/lib/kms/adminGebruikers';
import { logAudit, logWijziging } from '@/lib/kms/audit';

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
  await eisEigenaar();
  const email = String(formData.get('email') ?? '');
  const naam = String(formData.get('naam') ?? '');
  const rol = String(formData.get('rol') ?? 'medewerker');
  const res = await maakAdmin({ email, naam, rol });
  revalidatePath('/dashboard/admins');
  if (!res.ok) redirect('/dashboard/admins?fout=opslaan');
  await logAudit('beheerder_toegevoegd', {
    entiteit: 'beheerder',
    details: { email: email.toLowerCase().trim(), naam: naam || null, rol },
  });
  redirect('/dashboard/admins');
}

export async function adminActiefZetten(formData: FormData) {
  if (!(await eigenaarGuard())) redirect('/dashboard/admins?fout=toegang');
  await eisEigenaar();
  const id = String(formData.get('id') ?? '');
  const actief = String(formData.get('actief') ?? '') === 'true';
  const voor = await getAdmin(id);
  const res = await zetAdminActief(id, actief);
  if (res.ok && voor) {
    await logWijziging(actief ? 'beheerder_geactiveerd' : 'beheerder_gedeactiveerd', {
      entiteit: 'beheerder',
      entiteitId: id,
      voor: { actief: voor.actief },
      na: { actief },
      extra: { email: voor.email },
    });
  }
  revalidatePath('/dashboard/admins');
  redirect('/dashboard/admins');
}

export async function adminRolWijzigen(formData: FormData) {
  if (!(await eigenaarGuard())) redirect('/dashboard/admins?fout=toegang');
  await eisEigenaar();
  const id = String(formData.get('id') ?? '');
  const rol = String(formData.get('rol') ?? '');
  const voor = await getAdmin(id);
  const res = await wijzigAdminRol(id, rol);
  if (res.ok && voor) {
    await logWijziging('beheerder_rol_gewijzigd', {
      entiteit: 'beheerder',
      entiteitId: id,
      voor: { rol: voor.rol },
      na: { rol },
      extra: { email: voor.email },
    });
  }
  revalidatePath('/dashboard/admins');
  const terug = '/dashboard/admins';
  redirect(`${terug}${terug.includes('?') ? '&' : '?'}ok=bijgewerkt`);
}

/** Tweestapsverificatie van een beheerder uitzetten (bv. telefoon kwijt). Alleen eigenaar. */
export async function adminTweeStapUitzetten(formData: FormData) {
  if (!(await eigenaarGuard())) redirect('/dashboard/admins?fout=toegang');
  await eisEigenaar();
  const id = String(formData.get('id') ?? '');
  const doel = await getAdmin(id);
  if (!doel) redirect('/dashboard/admins?fout=tweestap');
  const res = await zetTweeStapUit(doel.email);
  if (!res.ok) redirect('/dashboard/admins?fout=tweestap');
  await logAudit('tweestapsverificatie_uitgezet_door_eigenaar', {
    entiteit: 'beheerder',
    entiteitId: id,
    details: { email: doel.email },
  });
  revalidatePath('/dashboard/admins');
  redirect('/dashboard/admins?ok=tweestap');
}
