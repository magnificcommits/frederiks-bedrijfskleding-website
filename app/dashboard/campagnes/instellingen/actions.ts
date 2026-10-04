'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { zetCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { logAudit } from '@/lib/kms/audit';

export async function bewaarCampagneInstellingenActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const limiet = Number(String(formData.get('dagLimiet') ?? '').replace(/[^0-9]/g, ''));
  const testadres = String(formData.get('testadres') ?? '').trim();
  const reviewlink = String(formData.get('reviewlink') ?? '').trim();
  if (testadres && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testadres)) redirect('/dashboard/campagnes/instellingen?melding=' + encodeURIComponent('Het testadres klopt niet.'));
  if (reviewlink && !/^https?:\/\//i.test(reviewlink)) redirect('/dashboard/campagnes/instellingen?melding=' + encodeURIComponent('De reviewlink moet met https:// beginnen.'));
  const ok = await zetCampagneInstellingen({
    dagLimiet: Number.isFinite(limiet) && limiet > 0 ? limiet : 60,
    testadres,
    reviewlink,
    afzenderNaam: String(formData.get('afzenderNaam') ?? '').trim(),
    allesGepauzeerd: formData.get('allesGepauzeerd') === 'on',
  });
  await logAudit('campagnes_instellingen_gewijzigd', { entiteit: 'instellingen', details: { dagLimiet: limiet, ok } });
  redirect(ok ? '/dashboard/campagnes/instellingen?ok=opgeslagen' : '/dashboard/campagnes/instellingen?melding=' + encodeURIComponent('Opslaan is niet gelukt.'));
}
