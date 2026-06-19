import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getBoekhouderEmail } from '@/lib/kms/facturen';
import { getRetourtermijn } from '@/lib/portaal/service';
import { getSpaarInstellingen } from '@/lib/kms/sparen';
import { zetBoekhouderActie, zetRetourActie, zetSpaarActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function InstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const { ok } = await searchParams;
  const [boekhouderEmail, termijn, spaar] = await Promise.all([
    getBoekhouderEmail(),
    getRetourtermijn(),
    getSpaarInstellingen(),
  ]);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Instellingen</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Hier beheer je de instellingen die over meerdere modules verspreid stonden, op één plek bij elkaar.</p>

      {ok === 'boekhouder' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">E-mailadres van de boekhouder opgeslagen.</p>
      )}
      {ok === 'retour' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">Retourbeleid opgeslagen.</p>
      )}
      {ok === 'sparen' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">Spaarinstellingen opgeslagen.</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Boekhouder */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Boekhouder</h2>
          <p className="mt-1 text-xs text-warm">Facturen worden naar dit adres gemaild.</p>
          <form action={zetBoekhouderActie} className="mt-4 flex flex-col gap-3">
            <div>
              <label htmlFor="boekhouder_email" className="block text-xs font-semibold text-warm">E-mailadres boekhouder</label>
              <input
                id="boekhouder_email"
                name="email"
                type="email"
                defaultValue={boekhouderEmail}
                placeholder="boekhouder@voorbeeld.nl"
                className={inputCls}
              />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
          </form>
        </div>

        {/* Retourbeleid */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Retourbeleid</h2>
          <p className="mt-1 text-xs text-warm">Tot zoveel dagen na de besteldatum kunnen klanten retourneren.</p>
          <form action={zetRetourActie} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="retourtermijn" className="block text-xs font-semibold text-warm">Retourtermijn (dagen)</label>
              <input
                id="retourtermijn"
                name="dagen"
                type="number"
                min={1}
                defaultValue={termijn}
                className={`${inputCls} w-32`}
              />
            </div>
            <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
          </form>
        </div>

        {/* Spaarsysteem */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-ink-900">Spaarsysteem</h2>
          <p className="mt-1 text-xs text-warm">Bedrijven sparen punten op hun bestellingen, in te wisselen voor korting op een volgende bestelling.</p>
          <form action={zetSpaarActie} className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="spaar_actief" className="block text-xs font-semibold text-warm">Spaarsysteem</label>
              <select id="spaar_actief" name="actief" defaultValue={spaar.actief ? 'aan' : 'uit'} className={inputCls}>
                <option value="aan">Aan</option>
                <option value="uit">Uit</option>
              </select>
            </div>
            <div>
              <label htmlFor="punten_per_euro" className="block text-xs font-semibold text-warm">Punten per bestede euro</label>
              <input id="punten_per_euro" type="number" name="punten_per_euro" step="0.01" min="0" defaultValue={spaar.puntenPerEuro} className={`${inputCls} w-44`} />
            </div>
            <div>
              <label htmlFor="euro_per_punt" className="block text-xs font-semibold text-warm">Kortingswaarde per punt (in euro)</label>
              <input id="euro_per_punt" type="number" name="euro_per_punt" step="0.001" min="0" defaultValue={spaar.euroPerPunt} className={`${inputCls} w-44`} />
            </div>
            <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
          </form>
          <p className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-xs text-warm">
            Voorbeeld: bij {spaar.puntenPerEuro} punt per euro en een kortingswaarde van {spaar.euroPerPunt} euro per punt levert 100 euro omzet {Math.round(100 * spaar.puntenPerEuro)} punten op, samen goed voor {(100 * spaar.puntenPerEuro * spaar.euroPerPunt).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })} korting.
          </p>
        </div>
      </div>
    </main>
  );
}
