import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getBestellingen } from '@/lib/portaal/queries';

export const metadata: Metadata = { title: 'Mijn bestellingen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const datum = (s: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s));

const statusLabel: Record<string, string> = {
  nieuw: 'Nieuw',
  in_behandeling: 'In behandeling',
  geleverd: 'Geleverd',
  geannuleerd: 'Geannuleerd',
};

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel[status] ?? status;
  const toon =
    status === 'geleverd'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'geannuleerd'
        ? 'border-line bg-cream text-warm'
        : 'border-amber-300 bg-amber-50 text-amber-700';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Bestellingen({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
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
  const bestellingen = await getBestellingen();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Mijn bestellingen</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/portaal/herbestellen" className="btn-primary">Herbestellen</Link>
          <Link href="/portaal" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar portaal</Link>
        </div>
      </div>

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          Je aanvraag is verstuurd, we nemen contact op.
        </div>
      )}

      {bestellingen.length === 0 ? (
        <p className="mt-8 text-sm text-warm">Je hebt nog geen bestellingen. Begin een nieuwe aanvraag via Herbestellen.</p>
      ) : (
        <div className="mt-8 space-y-5">
          {bestellingen.map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink-900">{datum(b.created_at)}</p>
                <StatusBadge status={b.status} />
              </div>

              {b.portaal_bestelregels.length > 0 ? (
                <ul className="mt-4 divide-y divide-line text-sm">
                  {b.portaal_bestelregels.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span className="text-ink-800">{r.item_naam}{r.maat ? ` · maat ${r.maat}` : ''}</span>
                      <span className="font-semibold text-ink-900">{r.aantal}x</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-warm">Geen regels bij deze bestelling.</p>
              )}

              {b.notitie && (
                <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">Opmerking:</span> {b.notitie}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
