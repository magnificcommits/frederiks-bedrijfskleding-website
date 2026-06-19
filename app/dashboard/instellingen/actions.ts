'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { zetBoekhouderEmail } from '@/lib/kms/facturen';
import { zetRetourtermijn } from '@/lib/portaal/service';
import { zetSpaarInstellingen } from '@/lib/kms/sparen';
import { logAudit } from '@/lib/kms/audit';

/**
 * Server actions voor de gebundelde instellingen-pagina. Elk blok post naar een
 * eigen action, achter dashAuthed(), met audit-log en een ?ok=-redirect voor
 * feedback. Hergebruikt de bestaande lib-functies (geen nieuwe data-laag).
 */

export async function zetBoekhouderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const email = String(formData.get('email') ?? '').trim();
  await zetBoekhouderEmail(email);
  await logAudit('boekhouder_email_gewijzigd', { entiteit: 'instellingen' });
  redirect('/dashboard/instellingen?ok=boekhouder');
}

export async function zetRetourActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const dagen = Number.parseInt(String(formData.get('dagen') ?? '').trim(), 10);
  const veilig = Number.isFinite(dagen) && dagen > 0 ? dagen : 30;
  await zetRetourtermijn(veilig);
  await logAudit('retourbeleid_gewijzigd', { entiteit: 'instellingen', details: { dagen: veilig } });
  redirect('/dashboard/instellingen?ok=retour');
}

export async function zetSpaarActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const actief = String(formData.get('actief') ?? '') === 'aan';
  const puntenPerEuro = Number(String(formData.get('punten_per_euro') ?? '').replace(',', '.')) || 1;
  const euroPerPunt = Number(String(formData.get('euro_per_punt') ?? '').replace(',', '.')) || 0.01;
  await zetSpaarInstellingen({ actief, puntenPerEuro, euroPerPunt });
  await logAudit('spaarinstellingen_gewijzigd', { entiteit: 'instellingen' });
  redirect('/dashboard/instellingen?ok=sparen');
}
