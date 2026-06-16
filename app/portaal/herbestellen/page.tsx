import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn } from '@/lib/portaal/queries';
import { vraagHerbestelling } from './actions';

export const metadata: Metadata = { title: 'Herbestellen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Herbestellen({ searchParams }: { searchParams: Promise<{ leeg?: string; fout?: string }> }) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Het portaal staat nog niet aan. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');

  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Je account is nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const items = await getKledinglijn();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Herbestellen</h1>
        </div>
        <Link href="/portaal" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar portaal</Link>
      </div>

      <p className="mt-4 max-w-2xl text-sm text-warm">Vul per kledingstuk de maat en het aantal in. Laat het aantal op 0 staan voor stukken die je niet nodig hebt. We zetten je aanvraag klaar en nemen contact op om hem af te ronden.</p>

      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Je had nog geen aantallen ingevuld. Zet bij minstens een kledingstuk een aantal hoger dan 0.
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Er ging iets mis bij het versturen. Probeer het zo nog eens of bel ons even.
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-warm">Er is nog geen kledinglijn ingesteld. Frederiks stelt deze eerst voor je samen.</p>
      ) : (
        <form action={vraagHerbestelling} className="mt-8 max-w-3xl">
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
            {items.map((i, idx) => (
              <div key={i.id} className={`flex flex-wrap items-end gap-4 p-5 ${idx > 0 ? 'border-t border-line' : ''}`}>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-bold text-ink-900">{i.naam}</p>
                  <p className="mt-1 text-sm text-warm">{[i.merk, i.kleur].filter(Boolean).join(' · ') || 'Geen details'}</p>
                </div>
                <div>
                  <label htmlFor={`maat_${i.id}`} className="block text-xs font-semibold text-warm">Maat</label>
                  <input id={`maat_${i.id}`} name={`maat_${i.id}`} type="text" placeholder="bijv. L"
                    className="mt-1 w-24 rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor={`aantal_${i.id}`} className="block text-xs font-semibold text-warm">Aantal</label>
                  <input id={`aantal_${i.id}`} name={`aantal_${i.id}`} type="number" min={0} step={1} defaultValue={0}
                    className="mt-1 w-24 rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label htmlFor="notitie" className="block text-sm font-semibold text-ink-900">Opmerking (optioneel)</label>
            <textarea id="notitie" name="notitie" rows={3} placeholder="Bijvoorbeeld een gewenste leverdatum of een vraag over een maat."
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none" />
          </div>

          <button type="submit" className="btn-primary mt-6">Aanvraag versturen</button>
        </form>
      )}
    </main>
  );
}
