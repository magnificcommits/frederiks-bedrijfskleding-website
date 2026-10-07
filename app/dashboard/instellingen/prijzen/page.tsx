import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { berekenPrijsindicatie, getPrijsInstellingen } from '@/lib/kms/prijsindicatieData';
import { euro } from '@/lib/kms/prijsindicatie';
import { kledingtypes } from '@/content/configurator';
import { zetPrijsActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prijsindicaties', robots: { index: false, follow: false } };

export default async function PrijsInstellingenPage({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { ok, fout } = await searchParams;
  const inst = await getPrijsInstellingen();
  const p = await berekenPrijsindicatie(inst);
  const typeNaam = (id: string) => kledingtypes.find((k) => k.id === id)?.label ?? id;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Prijsindicaties op de website</h1>
        <Link href="/dashboard/instellingen" className="knop-tekst">Terug naar instellingen</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-warm">
        Toont bezoekers een &lsquo;vanaf&rsquo;-prijs per medewerker in de pakketsamensteller en op de branchepagina&apos;s, de logoprijzen op
        de pagina Bedrukken en borduren, en een prijsklasse (€, €€, €€€) op productpagina&apos;s. Nooit een exacte artikelprijs: die zien
        klanten na inloggen of in hun offerte.
      </p>
      {ok && <p className="mt-3 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-800">Opgeslagen. De website past zich binnen een minuut aan.</p>}
      {fout && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-ink-800">Opslaan mislukt.</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form action={zetPrijsActie} className="rounded-xl border border-line bg-white p-5 shadow-soft">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="aan" defaultChecked={inst.aan} className="mt-1 h-5 w-5 rounded border-line" />
            <span>
              <span className="block font-semibold text-ink-900">Prijsindicaties tonen op de website</span>
              <span className="block text-sm text-warm">Staat dit uit, dan ziet de site er precies zo uit als nu.</span>
            </span>
          </label>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="veld-label">Korting op adviesprijs (%)</span>
              <input name="korting" defaultValue={inst.korting} inputMode="decimal" className="veld mt-1" />
              <span className="mt-1 block text-xs text-warm">De korting die je een nieuwe klant standaard geeft op de adviesprijs van de fabrikant. Niet op logo&apos;s.</span>
            </label>
            <label className="block">
              <span className="veld-label">Rekenen met teamgrootte</span>
              <input name="team" defaultValue={inst.teamAantal} inputMode="numeric" className="veld mt-1" />
              <span className="mt-1 block text-xs text-warm">Bepaalt de logostaffel in de &lsquo;vanaf&rsquo;-prijs. Standaard 15.</span>
            </label>
          </div>
          <button className="btn-primary mt-5">Opslaan</button>
        </form>

        <section className="rounded-xl border border-line bg-white p-5 shadow-soft">
          <h2 className="font-semibold text-ink-900">Zo ziet de bezoeker het {inst.aan ? '(staat aan)' : '(voorbeeld, staat uit)'}</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-warm">
                <th className="py-1.5">Startpakket</th>
                <th className="py-1.5 text-right">Vanaf ca. per medewerker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.entries(p.perBranche).map(([b, v]) => (
                <tr key={b}>
                  <td className="py-1.5">{b}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{euro(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-warm">Inclusief geborduurd logo, excl. btw en eenmalige kosten (borduurkaart, instelkosten).</p>
          <h3 className="mt-5 text-sm font-semibold text-ink-900">Rekenprijs per kledingstuk (na korting)</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(p.typePrijzen).map(([t, v]) => (
              <li key={t} className="flex justify-between gap-2">
                <span className="text-warm">{typeNaam(t)}</span>
                <span className="tabular-nums">{euro(v * (1 - p.korting / 100), 2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-warm">Per type de 25%-grens van de adviesprijzen in het assortiment: een degelijk basisartikel, niet het goedkoopste.</p>
        </section>
      </div>
    </main>
  );
}
