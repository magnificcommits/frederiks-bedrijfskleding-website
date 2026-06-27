import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties } from '@/lib/kms/pakketten';
import { listDrukproevenVoorKlant } from '@/lib/kms/drukproeven';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import EmptyState from '@/components/dashboard/EmptyState';
import DrukproefMaker from './DrukproefMaker';
import DrukproefPreview from './DrukproefPreview';
import { verwijderDrukproefActie, verstuurDrukproefActie } from './actions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drukproeven', robots: { index: false, follow: false } };

const datum = (s: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s));

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-700',
  verstuurd: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-green-100 text-green-800',
  afgekeurd: 'bg-red-100 text-red-700',
};

export default async function DrukproevenPage({ searchParams }: { searchParams: Promise<{ org?: string; ok?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { org } = await searchParams;
  const orgs = await listOrganisaties();
  const gekozen = org && orgs.some((o) => o.id === org) ? org : '';

  let klant: { id: string; naam: string; portaal_logo_url: string | null } | null = null;
  let drukproeven: Awaited<ReturnType<typeof listDrukproevenVoorKlant>> = [];
  if (gekozen) {
    const { data } = await sb.from('organisaties').select('id, naam, portaal_logo_url').eq('id', gekozen).maybeSingle();
    klant = (data as { id: string; naam: string; portaal_logo_url: string | null } | null) ?? null;
    drukproeven = await listDrukproevenVoorKlant(gekozen);
  }

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Drukproeven</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">
        Maak per klant een drukproef: kies een kledingstuk, kleur, logopositie en techniek en zie meteen een voorbeeld met het klantlogo. Of upload een eigen afbeelding als definitieve proef.
      </p>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="min-w-[16rem]">
            <label className="block text-xs font-semibold text-warm">Klant</label>
            <div className="mt-1">
              <NavigateSelect options={orgs.map((o) => ({ value: o.id, label: o.naam }))} value={gekozen} basePath="/dashboard/drukproeven" param="org" placeholder="Kies een klant" />
            </div>
          </div>
        </div>
      </section>

      {!gekozen ? (
        <div className="mt-8">
          <EmptyState
            titel="Kies eerst een klant"
            tekst="Selecteer hierboven een klant om bestaande drukproeven te zien en een nieuwe te maken."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-ink-900">Drukproeven van {klant?.naam ?? ''}</h2>
            {drukproeven.length === 0 ? (
              <div className="mt-4">
                <EmptyState tekst="Nog geen drukproeven voor deze klant. Maak er rechts een aan." />
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {drukproeven.map((d) => (
                  <li key={d.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-soft">
                    <div className="rounded-lg border border-line bg-mist p-3">
                      <div className="mx-auto w-full max-w-[180px]">
                        <DrukproefPreview
                          afbeeldingUrl={d.afbeelding_url}
                          type={d.type}
                          kleur={d.kleur}
                          logoUrl={d.logo_url}
                          positie={d.positie}
                          techniek={d.techniek}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink-900">{d.naam}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[d.status] ?? 'bg-ink-100 text-ink-700'}`}>{d.status}</span>
                    </div>
                    {d.omschrijving && <p className="mt-1 text-xs text-warm">{d.omschrijving}</p>}
                    <p className="mt-1 text-xs text-warm">Aangemaakt op {datum(d.created_at)}</p>

                    {(d.status === 'goedgekeurd' || d.status === 'afgekeurd') && d.opmerking && (
                      <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-xs text-ink-700">
                        <span className="font-semibold">Reactie klant:</span> {d.opmerking}
                      </p>
                    )}

                    {(d.status === 'concept' || d.status === 'verstuurd') && (
                      <form action={verstuurDrukproefActie} className="mt-3 border-t border-line pt-3">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="org_id" value={gekozen} />
                        <label className="block text-xs font-semibold text-warm">Versturen naar klant (e-mail)</label>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="email"
                            name="email"
                            required
                            placeholder="naam@bedrijf.nl"
                            className="min-w-0 flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm"
                          />
                          <button type="submit" className="shrink-0 rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">
                            {d.status === 'verstuurd' ? 'Opnieuw' : 'Versturen'}
                          </button>
                        </div>
                        <p className="mt-1.5 break-all text-[11px] text-warm">
                          Of deel deze link: {env.siteUrl}/drukproef/{d.token}
                        </p>
                      </form>
                    )}

                    <form action={verwijderDrukproefActie} className="mt-3">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="org_id" value={gekozen} />
                      <button type="submit" className="text-xs font-semibold text-red-600 hover:text-red-700">Verwijderen</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DrukproefMaker orgId={gekozen} klantLogoUrl={klant?.portaal_logo_url ?? null} />
        </div>
      )}
    </main>
  );
}
