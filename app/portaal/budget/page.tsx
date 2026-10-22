import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPortaalUser } from '@/lib/portaal/queries';
import { getMijnToegang, listTeam } from '@/lib/portaal/team';
import { getBudgetVerbruik, getMijnWebshopOrganisatie } from '@/lib/portaal/webshop';
import { getVertaler } from '@/lib/i18n/portaal/server';
import PortaalNav from '../PortaalNav';
import { budgetVoorIedereenActie, maxPerBestellingActie } from './actions';

export const metadata: Metadata = { title: 'Budget', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MELDING: Record<string, { tekst: string; fout?: boolean }> = {
  bulk: { tekst: 'Budget ingesteld.' },
  max: { tekst: 'Maximaal bedrag per bestelling opgeslagen.' },
  rol: { tekst: 'Alleen een beheerder kan budgetten aanpassen.', fout: true },
  bedrag: { tekst: 'Vul een geldig bedrag in.', fout: true },
  opslaan: { tekst: 'Opslaan is niet gelukt. Probeer het opnieuw.', fout: true },
};

/**
 * Budget in het portaal (werkdocument portaal 21 okt, punt 1). Beheerder en
 * leidinggevende zien per medewerker het budget, wat er al besteld is en wat er
 * over is. De beheerder kan in één keer een budget voor iedereen zetten en het
 * maximum per bestelling aanpassen. Per medewerker aanpassen gaat via de
 * medewerkerpagina (budgetinstellingen).
 */
export default async function BudgetPagina({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string; n?: string }> }) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const [toegang, v] = await Promise.all([getMijnToegang(), getVertaler()]);
  if (toegang.rol !== 'beheerder' && toegang.rol !== 'leidinggevende') redirect('/portaal');
  const { euro } = v;
  const sp = await searchParams;
  const melding = MELDING[sp.ok ?? sp.fout ?? ''];
  const beheerder = toegang.rol === 'beheerder';

  const [org, team] = await Promise.all([getMijnWebshopOrganisatie(), listTeam()]);
  const actief = team.filter((m) => m.actief);
  const rijen = await Promise.all(
    actief.map(async (m) => {
      const verbruikt = m.budget != null ? await getBudgetVerbruik(m.medewerkerId) : 0;
      return { ...m, verbruikt, over: m.budget != null ? m.budget - verbruikt : null };
    }),
  );
  const totaalBudget = rijen.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totaalVerbruikt = rijen.reduce((s, r) => s + (r.budget != null ? r.verbruikt : 0), 0);
  const zonder = rijen.filter((r) => r.budget == null).length;

  return (
    <main className="container-x py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{v.t('algemeen.klantportaal')}</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Budget</h1>
      <PortaalNav rol={toegang.rol} actief="/portaal/budget" />

      {melding && (
        <p className={`mt-6 rounded-xl border px-4 py-3 text-sm ${melding.fout ? 'border-amber-300 bg-amber-50 text-ink-800' : 'border-green-300 bg-green-50 text-green-800'}`} role="status">
          {melding.tekst}
          {sp.ok === 'bulk' && sp.n ? ` (${sp.n} medewerkers)` : ''}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-sm text-warm">Budget alle medewerkers samen</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{euro(totaalBudget)}</p>
          <p className="mt-1 text-sm text-warm">{euro(totaalVerbruikt)} besteld, {euro(Math.max(0, totaalBudget - totaalVerbruikt))} over</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-sm text-warm">Maximaal per bestelling</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{org?.max_bestelbedrag != null ? euro(Number(org.max_bestelbedrag)) : 'Geen maximum'}</p>
          <p className="mt-1 text-sm text-warm">Geldt voor elke bestelling, los van het budget.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-sm text-warm">Medewerkers zonder budget</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{zonder}</p>
          <p className="mt-1 text-sm text-warm">Zij kunnen bestellen zonder budgetgrens.</p>
        </div>
      </div>

      <section className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
            <tr>
              <th className="px-4 py-3">Medewerker</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3 text-right">Besteld</th>
              <th className="px-4 py-3 text-right">Over</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.medewerkerId} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3 font-semibold text-ink-900">{r.naam}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.budget != null ? euro(r.budget) : <span className="text-warm">geen</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.budget != null ? euro(r.verbruikt) : '-'}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.over != null && r.over < 0 ? 'text-red-700' : 'text-ink-900'}`}>{r.over != null ? euro(r.over) : '-'}</td>
                <td className="px-4 py-3 text-right">
                  {beheerder && (
                    <Link href={`/portaal/team/${r.medewerkerId}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Aanpassen</Link>
                  )}
                </td>
              </tr>
            ))}
            {rijen.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-warm">Nog geen medewerkers.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {beheerder ? (
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form action={budgetVoorIedereenActie} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Budget voor iedereen instellen</h2>
            <p className="mt-1 text-sm text-warm">Bijvoorbeeld € 250 per medewerker per jaar. Per persoon aanpassen kan daarna via Aanpassen.</p>
            <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="budget-alle">Budget per medewerker (€)</label>
            <input id="budget-alle" name="budget" inputMode="decimal" required placeholder="bijv. 250" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name="iedereen" className="h-4 w-4" /> Ook voor medewerkers die al een budget hebben
            </label>
            <button type="submit" className="btn-primary mt-4">Budget instellen</button>
          </form>
          <form action={maxPerBestellingActie} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Maximaal bedrag per bestelling</h2>
            <p className="mt-1 text-sm text-warm">Een bestelling boven dit bedrag kan niet worden geplaatst. Leeg = geen maximum.</p>
            <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="max-bestelling">Maximum (€)</label>
            <input id="max-bestelling" name="max" inputMode="decimal" defaultValue={org?.max_bestelbedrag ?? ''} placeholder="geen maximum" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
            <button type="submit" className="btn-primary mt-4">Opslaan</button>
          </form>
        </div>
      ) : (
        <p className="mt-6 text-sm text-warm">Budgetten aanpassen kan de beheerder van jullie portaal.</p>
      )}
    </main>
  );
}
