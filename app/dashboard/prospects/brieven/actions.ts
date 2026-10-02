'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { datumNL } from '@/lib/prospect/prospect';

/**
 * Markeert de getoonde brieven als verstuurd: brief_verstuurd_op = vandaag en
 * status 'benaderd' voor wie nog op 'nieuw' stond. Verdere statussen
 * (geinteresseerd, klant, afgemeld) laten we staan.
 */
export async function markeerBrievenVerstuurdActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const ids = [...new Set(formData.getAll('id').map(String).filter((i) => /^[0-9a-f-]{36}$/i.test(i)))].slice(0, 200);
  const terug = String(formData.get('terug') ?? '');
  const veiligTerug = terug.startsWith('/dashboard/prospects/brieven') ? terug : '/dashboard/prospects/brieven';
  const sb = kmsAdmin();
  let aantal = 0;
  if (sb && ids.length) {
    const nu = new Date().toISOString();
    const { data } = await sb
      .from('prospecten')
      .update({ brief_verstuurd_op: datumNL(0), laatste_contact: nu })
      .in('id', ids)
      .is('afgemeld_op', null)
      .select('id');
    aantal = (data as { id: string }[] | null)?.length ?? 0;
    await sb.from('prospecten').update({ status: 'benaderd' }).in('id', ids).eq('status', 'nieuw').is('afgemeld_op', null);
    await logAudit('prospect.brieven_verstuurd', { entiteit: 'prospect', details: { aantal, ids } });
  }
  revalidatePath('/dashboard/prospects');
  revalidatePath('/dashboard/prospects/brieven');
  redirect(`${veiligTerug}${veiligTerug.includes('?') ? '&' : '?'}ok=bijgewerkt&verstuurd=${aantal}`);
}
