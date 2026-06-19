'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakRetour, zetRetourStatus, zetRetourInstructie } from '@/lib/kms/service';
import { zetRetourtermijn } from '@/lib/portaal/service';
import { logAudit } from '@/lib/kms/audit';

function tekstOfNull(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  return s === '' ? null : s;
}

export async function nieuwRetour(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await maakRetour({
    organisatie_id: tekstOfNull(formData.get('organisatie_id')),
    reden: tekstOfNull(formData.get('reden')),
  });
  redirect('/dashboard/retouren');
}

export async function zetRetourbeleid(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const dagen = Number.parseInt(String(formData.get('dagen') ?? '').trim(), 10);
  const veilig = Number.isFinite(dagen) && dagen > 0 ? dagen : 30;
  await zetRetourtermijn(veilig);
  await logAudit('retourbeleid_gewijzigd', { entiteit: 'instellingen', details: { dagen: veilig } });
  redirect('/dashboard/retouren?ok=beleid');
}

export async function wijzigRetourStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (id && status) {
    await zetRetourStatus(id, status);
    await logAudit('retourstatus_gewijzigd', { entiteit: 'retour', entiteitId: id, details: { status } });
  }
  redirect('/dashboard/retouren');
}

export async function wijzigRetourInstructie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  if (id) {
    await zetRetourInstructie(
      id,
      tekstOfNull(formData.get('retouradres')),
      tekstOfNull(formData.get('instructie')),
    );
  }
  redirect('/dashboard/retouren');
}
