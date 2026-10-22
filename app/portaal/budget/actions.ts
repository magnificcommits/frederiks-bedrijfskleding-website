'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getMijnToegang, listTeam, zetBudget } from '@/lib/portaal/team';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { logPortaal } from '@/lib/portaal/activiteit';

function bedrag(v: FormDataEntryValue | null): number | null {
  const ruw = String(v ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  if (ruw === '') return null;
  const n = Number(ruw);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null;
}

async function alleenBeheerder() {
  const t = await getMijnToegang();
  if (!t.email) redirect('/portaal/login');
  if (t.rol !== 'beheerder' || !t.organisatieId) redirect('/portaal/budget?fout=rol');
  return t;
}

/** Eén budget voor meerdere medewerkers tegelijk (alleen wie nog niets heeft, of iedereen). */
export async function budgetVoorIedereenActie(formData: FormData) {
  await alleenBeheerder();
  const b = bedrag(formData.get('budget'));
  if (b == null) redirect('/portaal/budget?fout=bedrag');
  const iedereen = formData.get('iedereen') === 'on';
  const team = (await listTeam()).filter((m) => m.actief && (iedereen || m.budget == null));
  let gelukt = 0;
  for (const m of team) if ((await zetBudget(m.medewerkerId, b)).ok) gelukt++;
  await logPortaal('budget_bulk');
  revalidatePath('/portaal/budget');
  redirect(`/portaal/budget?ok=bulk&n=${gelukt}`);
}

/**
 * Maximaal bedrag per bestelling van de eigen organisatie. De klant mag zijn
 * organisatie niet zelf bijwerken (RLS), dus dit loopt via de server, alleen
 * voor de beheerder en alleen voor zijn eigen organisatie.
 */
export async function maxPerBestellingActie(formData: FormData) {
  const t = await alleenBeheerder();
  const sb = kmsAdmin();
  if (!sb) redirect('/portaal/budget?fout=opslaan');
  const b = bedrag(formData.get('max'));
  const { error } = await sb.from('organisaties').update({ max_bestelbedrag: b }).eq('id', t.organisatieId!);
  if (error) redirect('/portaal/budget?fout=opslaan');
  await logPortaal('max_bestelbedrag');
  revalidatePath('/portaal/budget');
  redirect('/portaal/budget?ok=max');
}
