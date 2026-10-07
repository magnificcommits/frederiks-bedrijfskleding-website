import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { getReviewInstellingen } from '@/lib/reviews/reviews';
import { listUitnodigingen, uitnodigingCijfers } from '@/lib/reviews/uitnodigingen';
import { datumKort, nlDelen } from '@/app/dashboard/taken/tijd';
import PaginaKop from '@/components/dashboard/ui/PaginaKop';
import { overslaanActie, toevoegenActie, verstuurActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review-uitnodigingen', robots: { index: false, follow: false } };

const FILTERS = [
  { id: 'open', label: 'Te accorderen' },
  { id: 'verstuurd', label: 'Verstuurd' },
  { id: 'overgeslagen', label: 'Overgeslagen' },
  { id: 'alle', label: 'Alles' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

function melding(m: string | undefined): { tekst: string; fout?: boolean } | null {
  if (!m) return null;
  const [soort, a, b] = m.split(':');
  if (soort === 'verstuurd') return { tekst: `${a} uitnodiging${a === '1' ? '' : 'en'} verstuurd.` };
  if (soort === 'deels') return { tekst: `${a} verstuurd, ${b} mislukt. De mislukte blijven op de lijst; probeer ze later opnieuw.`, fout: true };
  if (soort === 'overgeslagen') return { tekst: `${a} overgeslagen. Ze komen de komende 90 dagen niet opnieuw voorbij.` };
  if (soort === 'toegevoegd') return { tekst: 'Klant toegevoegd aan de lijst.' };
  if (soort === 'geenlink') return { tekst: 'Er is nog geen Google-reviewlink ingesteld. Zet die eerst bij Reviews > Instellingen.', fout: true };
  if (soort === 'niets') return { tekst: 'Vink eerst minstens één klant aan.', fout: true };
  if (soort === 'fout') return { tekst: m.slice(5), fout: true };
  return null;
}

const STATUS: Record<string, string> = { voorgesteld: 'badge-actie', mislukt: 'badge bg-red-100 text-red-800', verstuurd: 'badge-klaar', overgeslagen: 'badge-rust' };

export default async function UitnodigingenPage({ searchParams }: { searchParams: Promise<{ filter?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { filter: f, melding: m } = await searchParams;
  const filter: Filter = (FILTERS.find((x) => x.id === f)?.id ?? 'open') as Filter;
  const sb = kmsAdmin();
  const [lijst, cijfers, inst, klanten] = await Promise.all([
    listUitnodigingen(filter),
    uitnodigingCijfers(),
    getReviewInstellingen(),
    sb ? sb.from('organisaties').select('id, naam').order('naam').limit(1000).then((r) => (r.data as { id: string; naam: string }[]) ?? []) : Promise.resolve([]),
  ]);
  const msg = melding(m);
  const heeftLink = /^https?:\/\//i.test(inst.googleLink);
  const open = filter === 'open';

  return (
    <main className="container-app py-6">
      <PaginaKop
        titel="Review-uitnodigingen"
        sub="Elke maandag stelt het KMS klanten voor die net geleverd kregen en tevreden lijken. Jij kiest wie een mail krijgt met de link naar Google. Er gaat niets vanzelf de deur uit."
        acties={<Link href="/dashboard/reviews" className="knop-stil">Naar reviews en NPS</Link>}
      />

      {msg && (
        <p className={`mt-4 rounded-lg border px-4 py-2 text-sm font-semibold ${msg.fout ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{msg.tekst}</p>
      )}
      {!heeftLink && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          Nog geen Google-reviewlink ingesteld. Haal hem op in je Google Bedrijfsprofiel (Reviews vragen) en zet hem bij{' '}
          <Link href="/dashboard/reviews" className="font-semibold underline">Reviews en NPS</Link>. Tot die tijd kun je wel accorderen, maar niet versturen.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel p-4"><p className="font-display text-2xl font-extrabold tabular-nums">{cijfers.open}</p><p className="text-[12px] font-semibold text-ink-700">Te accorderen</p></div>
        <div className="panel p-4"><p className="font-display text-2xl font-extrabold tabular-nums">{cijfers.verstuurd}</p><p className="text-[12px] font-semibold text-ink-700">Verstuurd</p></div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-extrabold tabular-nums">{cijfers.geklikt}</p>
          <p className="text-[12px] font-semibold text-ink-700">Op de Google-knop geklikt</p>
          {cijfers.verstuurd > 0 && <p className="text-[11px] text-warm">{Math.round((cijfers.geklikt / cijfers.verstuurd) * 100)}% van de verstuurde mails</p>}
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map((x) => (
          <Link key={x.id} href={`/dashboard/reviews/uitnodigingen?filter=${x.id}`} className={`chip ${x.id === filter ? 'chip-aan' : ''}`}>{x.label}</Link>
        ))}
      </nav>

      <form className="panel mt-3 overflow-x-auto">
        {lijst.length === 0 ? (
          <p className="p-6 text-sm text-warm">{open ? 'Niets te accorderen. Maandag komt er een nieuwe lijst, of voeg hieronder zelf een klant toe.' : 'Nog niets in deze weergave.'}</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                {open && <th className="w-10"><span className="sr-only">Kiezen</span></th>}
                <th>Klant</th>
                <th>Mail naar</th>
                <th>Waarom</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lijst.map((u) => (
                <tr key={u.id}>
                  {open && (
                    <td><input type="checkbox" name="id" value={u.id} defaultChecked={u.status === 'voorgesteld'} aria-label={`${u.bedrijf ?? 'Klant'} kiezen`} /></td>
                  )}
                  <td>
                    <Link href={`/dashboard/klanten/${u.organisatie_id}`} className="font-semibold hover:underline">{u.bedrijf ?? 'Klant'}</Link>
                    {u.bron === 'handmatig' && <span className="ml-2 text-[11px] text-warm">zelf toegevoegd</span>}
                  </td>
                  <td className="text-sm">{u.naam ? `${u.naam}, ` : ''}{u.email}</td>
                  <td className="text-sm text-warm">{u.reden}</td>
                  <td className="whitespace-nowrap text-sm">
                    <span className={STATUS[u.status] ?? 'badge-rust'}>{u.status}</span>
                    {u.verstuurd_op && <span className="ml-2 text-[11px] text-warm">{datumKort(nlDelen(new Date(u.verstuurd_op)).datum)}</span>}
                    {u.geklikt_op && <span className="ml-2 text-[11px] font-semibold text-green-700">geklikt</span>}
                    {u.fout && <span className="block text-[11px] text-red-700">{u.fout}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {open && lijst.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
            <button formAction={verstuurActie} className="knop" disabled={!heeftLink}>Verstuur naar aangevinkte klanten</button>
            <button formAction={overslaanActie} className="knop-stil">Aangevinkte overslaan</button>
            <p className="text-[12px] text-warm">Je ziet de mail hieronder. Klanten die je overslaat komen 90 dagen niet terug op de lijst.</p>
          </div>
        )}
      </form>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form action={toevoegenActie} className="panel p-4">
          <h2 className="text-sm font-bold text-ink-900">Zelf een klant toevoegen</h2>
          <p className="mt-1 text-[12px] text-warm">Bijvoorbeeld na een goed gesprek of een compliment aan de telefoon.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select name="organisatie_id" className="veld min-w-[16rem]" required defaultValue="">
              <option value="" disabled>Kies een klant…</option>
              {klanten.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
            </select>
            <button className="knop-stil">Toevoegen</button>
          </div>
        </form>
        <div className="panel p-4 text-sm">
          <h2 className="text-sm font-bold text-ink-900">Zo ziet de mail eruit</h2>
          <p className="mt-2"><strong>Onderwerp:</strong> Wil je ons helpen met een korte review?</p>
          <p className="mt-2 text-warm">Hoi [voornaam], fijn dat we jullie bedrijfskleding mochten verzorgen. Andere ondernemers in de regio kiezen hun leverancier vaak op basis van reviews op Google. Zou je in een paar zinnen willen vertellen hoe het je beviel?</p>
          <p className="mt-2 text-warm">[knop: Schrijf een review op Google]</p>
          <p className="mt-2 text-warm">Ging er iets niet goed? Laat het me dan liever direct weten, dan los ik het op. Dank je wel, Jessi Frederiks</p>
        </div>
      </section>
    </main>
  );
}
