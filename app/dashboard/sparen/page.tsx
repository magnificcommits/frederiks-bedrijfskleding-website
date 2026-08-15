import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { formatEuro, formatGetal } from '@/lib/format';
import { getSpaarInstellingen, getSpaarsaldoAlle } from '@/lib/kms/sparen';
import { zetSpaarInstellingenActie, wisselPuntenInActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Spaarsysteem', robots: { index: false, follow: false } };

const inputCls = 'veld';

export default async function SparenPage({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();

  const { ok, fout } = await searchParams;
  const [instellingen, saldi] = await Promise.all([getSpaarInstellingen(), getSpaarsaldoAlle()]);

  // Effectieve korting: 100 punten × euroPerPunt, afgezet tegen 1 bestede euro × puntenPerEuro.
  const voorbeeldPunten = Math.round(100 * instellingen.puntenPerEuro);
  const voorbeeldKorting = formatEuro(100 * instellingen.puntenPerEuro * instellingen.euroPerPunt);
  const kortingPct = instellingen.puntenPerEuro * instellingen.euroPerPunt * 100;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Spaarsysteem</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Bedrijven sparen punten op hun bestellingen. Punten zijn in te wisselen voor korting op een volgende bestelling. Verzilveren doe je hier op het dashboard.</p>

      {ok === 'instellingen' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">Instellingen opgeslagen.</p>
      )}
      {ok === 'ingewisseld' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">Punten ingewisseld.</p>
      )}
      {fout && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">{fout}</p>
      )}

      <div className="mt-6 panel p-4">
        <h2 className="font-display text-lg font-bold text-ink-900">Instellingen</h2>
        <p className="mt-1 text-xs text-warm">Bepaal hoeveel punten een klant per bestede euro spaart en wat een punt waard is bij inwisselen.</p>
        <form action={zetSpaarInstellingenActie} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="veld-label">Spaarsysteem</label>
            <select name="actief" defaultValue={instellingen.actief ? 'aan' : 'uit'} className={inputCls}>
              <option value="aan">Aan</option>
              <option value="uit">Uit</option>
            </select>
          </div>
          <div>
            <label className="veld-label">Punten per bestede euro</label>
            <input type="number" name="punten_per_euro" step="0.01" min="0" defaultValue={instellingen.puntenPerEuro} className={`${inputCls} w-44`} />
          </div>
          <div>
            <label className="veld-label">Kortingswaarde per punt (in euro)</label>
            <input type="number" name="euro_per_punt" step="0.001" min="0" defaultValue={instellingen.euroPerPunt} className={`${inputCls} w-44`} />
          </div>
          <button type="submit" className="knop-donker">Opslaan</button>
        </form>
        <p className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-xs text-warm">
          Voorbeeld: {formatGetal(instellingen.puntenPerEuro)} punt per euro, {formatGetal(voorbeeldPunten)} punten = {voorbeeldKorting}
          {' '}&rarr; {kortingPct.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}% spaarkorting.
        </p>
      </div>

      <h2 className="mt-10 font-display text-xl font-extrabold text-ink-900">Saldo per klant</h2>
      {saldi.length === 0 ? (
        <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Er zijn nog geen klanten. Voeg eerst klanten en orders toe.</p>
      ) : (
        <div className="mt-4 overflow-x-auto panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>Klant</th>
                <th>Verdiend</th>
                <th>Ingewisseld</th>
                <th>Saldo (punten)</th>
                <th>Waarde</th>
                <th>Inwisselen</th>
              </tr>
            </thead>
            <tbody>
              {saldi.map((r) => (
                <tr key={r.organisatieId} className="border-b border-line">
                  <td className="text-ink-900">{r.naam || '-'}</td>
                  <td className="whitespace-nowrap text-warm">{formatGetal(r.verdiend)}</td>
                  <td className="whitespace-nowrap text-warm">{formatGetal(r.ingewisseld)}</td>
                  <td className="whitespace-nowrap font-semibold text-ink-900">{formatGetal(r.saldo)}</td>
                  <td className="whitespace-nowrap text-warm">{formatEuro(r.euroWaarde)}</td>
                  <td>
                    <form action={wisselPuntenInActie} className="flex items-center gap-2">
                      <input type="hidden" name="organisatie_id" value={r.organisatieId} />
                      <input
                        type="number"
                        name="punten"
                        min="1"
                        max={r.saldo}
                        step="1"
                        placeholder="aantal"
                        className="w-24 rounded-md border border-line px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        aria-label={`Punten inwisselen voor ${r.naam || 'klant'}`}
                      />
                      <button type="submit" disabled={r.saldo <= 0} className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40">Inwisselen</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
