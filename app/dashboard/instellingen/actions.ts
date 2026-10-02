'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { zetBoekhouderEmail, getBoekhouderEmail } from '@/lib/kms/facturen';
import { zetRetourtermijn, getRetourtermijn } from '@/lib/portaal/service';
import { zetSpaarInstellingen } from '@/lib/kms/sparen';
import { logAudit, logWijziging } from '@/lib/kms/audit';

/**
 * Server actions voor de gebundelde instellingen-pagina. Elk blok post naar een
 * eigen action, achter dashAuthed(), met audit-log en een ?ok=-redirect voor
 * feedback. Hergebruikt de bestaande lib-functies (geen nieuwe data-laag).
 */

export async function zetBoekhouderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const email = String(formData.get('email') ?? '').trim();
  const vorig = await getBoekhouderEmail();
  await zetBoekhouderEmail(email);
  await logWijziging('boekhouder_email_gewijzigd', {
    entiteit: 'instellingen',
    voor: { boekhouder_email: vorig },
    na: { boekhouder_email: email },
  });
  redirect('/dashboard/instellingen?ok=boekhouder');
}

export async function zetRetourActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const dagen = Number.parseInt(String(formData.get('dagen') ?? '').trim(), 10);
  const veilig = Number.isFinite(dagen) && dagen > 0 ? dagen : 30;
  const vorig = await getRetourtermijn();
  await zetRetourtermijn(veilig);
  await logWijziging('retourbeleid_gewijzigd', {
    entiteit: 'instellingen',
    voor: { retourtermijn_dagen: vorig },
    na: { retourtermijn_dagen: veilig },
  });
  redirect('/dashboard/instellingen?ok=retour');
}

export async function zetSpaarActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const actief = String(formData.get('actief') ?? '') === 'aan';
  const puntenPerEuro = Number(String(formData.get('punten_per_euro') ?? '').replace(',', '.')) || 1;
  const euroPerPunt = Number(String(formData.get('euro_per_punt') ?? '').replace(',', '.')) || 0.01;
  await zetSpaarInstellingen({ actief, puntenPerEuro, euroPerPunt });
  await logAudit('spaarinstellingen_gewijzigd', { entiteit: 'instellingen' });
  redirect('/dashboard/instellingen?ok=sparen');
}
