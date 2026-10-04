'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logWijziging } from '@/lib/kms/audit';
import { getBoekhoudInstellingen, logBoekhoudPoging, NA_AANMAKEN, zetBoekhoudInstellingen, type NaAanmaken } from '@/lib/kms/boekhouding';
import { isMoneybirdGeconfigureerd, mbAdministraties, moneybirdAdministratieId } from '@/lib/kms/moneybird';

const PAD = '/dashboard/instellingen/boekhouding';

/** Controleert token en administratie-ID bij Moneybird en toont de naam van de administratie. */
export async function testVerbindingActie() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  if (!isMoneybirdGeconfigureerd()) {
    redirect(`${PAD}?testfout=${encodeURIComponent('Zet eerst MONEYBIRD_API_TOKEN en MONEYBIRD_ADMINISTRATIE_ID in Vercel en deploy opnieuw.')}`);
  }
  const r = await mbAdministraties();
  if (!r.ok) {
    await logBoekhoudPoging({ actie: 'test', gelukt: false, melding: r.melding });
    redirect(`${PAD}?testfout=${encodeURIComponent(r.melding)}`);
  }
  const id = moneybirdAdministratieId();
  const admin = (r.data ?? []).find((a) => String(a.id) === id);
  if (!admin) {
    const melding = `Het token werkt, maar administratie ${id} hoort er niet bij. Controleer MONEYBIRD_ADMINISTRATIE_ID (het getal in de adresbalk van Moneybird).`;
    await logBoekhoudPoging({ actie: 'test', gelukt: false, melding });
    redirect(`${PAD}?testfout=${encodeURIComponent(melding)}`);
  }
  await logBoekhoudPoging({ actie: 'test', gelukt: true, melding: `Verbonden met administratie ${admin.name}.` });
  redirect(`${PAD}?test=${encodeURIComponent(admin.name)}`);
}

export async function opslaanBoekhoudingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const voor = await getBoekhoudInstellingen();
  const na = String(formData.get('na_aanmaken') ?? '');
  const nieuw = {
    grootboekId: String(formData.get('grootboek_id') ?? '').replace(/\D/g, ''),
    autoDoorzetten: formData.get('auto_doorzetten') === 'on',
    naAanmaken: ((NA_AANMAKEN as readonly string[]).includes(na) ? na : voor.naAanmaken) as NaAanmaken,
  };
  const ok = await zetBoekhoudInstellingen(nieuw);
  if (!ok) redirect(`${PAD}?fout=1`);
  await logWijziging('boekhouding_instellingen_gewijzigd', { entiteit: 'instellingen', voor, na: nieuw });
  revalidatePath(PAD);
  redirect(`${PAD}?ok=1`);
}
