import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getCampagne, CAMPAGNE_STATUSSEN } from '@/lib/kms/campagnes';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import {
  wijzigCampagneStatusActie,
  voegStapActie,
  werkStapActie,
  verwijderStapActie,
  schrijfInActie,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campagne', robots: { index: false, follow: false } };

const inputCls = 'veld';

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  actief: 'bg-green-100 text-green-800',
  gepauzeerd: 'bg-amber-100 text-amber-800',
  afgerond: 'bg-ink-100 text-ink-600',
};

const typeLabel: Record<string, string> = {
  cold: 'Koude acquisitie',
  nurture: 'Nurture',
  reengage: 'Heractivatie',
};

export default async function CampagneDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; fout?: string; aantal?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id } = await params;
  const { ok, aantal } = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/campagnes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar campagnes</Link>
        </div>
      </main>
    );
  }

  const campagne = await getCampagne(id);
  if (!campagne) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Campagne niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze campagne bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/campagnes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar campagnes</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">{campagne.naam}</h1>
          <p className="mt-1 text-sm text-warm">
            {typeLabel[campagne.type] ?? campagne.type}
            {' · '}
            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[campagne.status] ?? 'bg-ink-100 text-ink-600'}`}>{campagne.status}</span>
          </p>
        </div>
        <Link href="/dashboard/campagnes" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar campagnes</Link>
      </div>

      {ok === 'ingeschreven' && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">{Number(aantal) || 0} prospect(s) nieuw ingeschreven.</p>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Stappen</h2>
            <p className="mt-1 text-xs text-warm">In het onderwerp en de body kun je <code>{'{{bedrijfsnaam}}'}</code>, <code>{'{{contactpersoon}}'}</code> en <code>{'{{ai}}'}</code> gebruiken. <code>{'{{ai}}'}</code> wordt per prospect vervangen door een gegenereerde openingszin als je AI-personalisatie voor die stap aanzet.</p>

            {campagne.stappen.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen stappen. Voeg hieronder de eerste stap toe.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {campagne.stappen.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line p-4">
                    <form action={werkStapActie} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="campagneId" value={campagne.id} />
                      <input type="hidden" name="stapId" value={s.id} />
                      <div>
                        <label className="veld-label">Volgorde</label>
                        <input name="volgorde" inputMode="numeric" defaultValue={String(s.volgorde ?? 1)} className={inputCls} />
                      </div>
                      <div>
                        <label className="veld-label">Wachttijd (dagen)</label>
                        <input name="wacht_dagen" inputMode="numeric" defaultValue={String(s.wacht_dagen ?? 0)} className={inputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="veld-label">Onderwerp</label>
                        <input name="onderwerp" required defaultValue={s.onderwerp ?? ''} className={inputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="veld-label">Bericht</label>
                        <textarea name="body" required rows={5} defaultValue={s.body ?? ''} className={inputCls} />
                      </div>
                      <label className="flex items-start gap-2 text-xs text-ink-700 sm:col-span-2">
                        <input type="checkbox" name="ai_personaliseer" defaultChecked={s.ai_personaliseer} className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                        <span>AI-personalisatie: vervang <code>{'{{ai}}'}</code> door een unieke openingszin per prospect</span>
                      </label>
                      <div className="flex items-center justify-between gap-3 sm:col-span-2">
                        <button type="submit" className="knop-donker">Stap opslaan</button>
                        <span className="text-xs text-warm">{campagne.verzondenPerStap[s.id] ?? 0} verzonden</span>
                      </div>
                    </form>
                    <form action={verwijderStapActie} className="mt-2">
                      <input type="hidden" name="campagneId" value={campagne.id} />
                      <input type="hidden" name="stapId" value={s.id} />
                      <ConfirmSubmit message="Deze stap verwijderen?" className="text-xs font-semibold text-warm hover:text-ink-800">Verwijderen</ConfirmSubmit>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Stap toevoegen</h2>
            <form action={voegStapActie} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="campagneId" value={campagne.id} />
              <div>
                <label className="veld-label">Volgorde</label>
                <input name="volgorde" inputMode="numeric" defaultValue={String(campagne.stappen.length + 1)} className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Wachttijd (dagen)</label>
                <input name="wacht_dagen" inputMode="numeric" defaultValue="0" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="veld-label">Onderwerp</label>
                <input name="onderwerp" required placeholder="Bijv. Werkkleding voor {{bedrijfsnaam}}" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="veld-label">Bericht</label>
                <textarea name="body" required rows={5} placeholder={'Beste {{contactpersoon}},\n\n{{ai}}\n\n...'} className={inputCls} />
              </div>
              <label className="flex items-start gap-2 text-xs text-ink-700 sm:col-span-2">
                <input type="checkbox" name="ai_personaliseer" className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                <span>AI-personalisatie: vervang <code>{'{{ai}}'}</code> door een unieke openingszin per prospect</span>
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className="knop-donker">Stap toevoegen</button>
              </div>
            </form>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
            <p className="mt-2"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[campagne.status] ?? 'bg-ink-100 text-ink-600'}`}>{campagne.status}</span></p>
            <form action={wijzigCampagneStatusActie} className="mt-4">
              <input type="hidden" name="campagneId" value={campagne.id} />
              <label className="veld-label">Wijzig status</label>
              <AutoSubmitSelect
                name="status"
                defaultValue={campagne.status}
                aria-label="Campagnestatus"
                className={inputCls}
                options={CAMPAGNE_STATUSSEN.map((s) => ({ value: s, label: s }))}
              />
            </form>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Inschrijvingen</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-warm">Totaal ingeschreven</dt><dd className="text-ink-900">{campagne.aantalInschrijvingen}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Actief</dt><dd className="text-ink-900">{campagne.aantalActief}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Verzonden mails</dt><dd className="text-ink-900">{campagne.aantalVerzonden}</dd></div>
              {campagne.aantalGefaald > 0 && <div className="flex justify-between gap-3"><dt className="text-warm">Mislukt</dt><dd className="font-semibold text-amber-700">{campagne.aantalGefaald}</dd></div>}
            </dl>
            {Object.keys(campagne.statusVerdeling).length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-warm">Inschrijvingen per status</p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {Object.entries(campagne.statusVerdeling).map(([s, n]) => (
                    <li key={s} className="flex justify-between gap-3"><span className="text-warm">{s}</span><span className="text-ink-900">{n}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Prospects inschrijven</h2>
            <p className="mt-1 text-xs text-warm">Schrijft prospecten met de gekozen status in. Afgemelde prospecten en klanten worden overgeslagen.</p>
            <form action={schrijfInActie} className="mt-3">
              <input type="hidden" name="campagneId" value={campagne.id} />
              <label className="veld-label">Prospect-status</label>
              <select name="prospectStatus" className={inputCls} defaultValue="">
                <option value="">Alle prospecten</option>
                {PROSPECT_STATUSSEN.filter((s) => s !== 'afgemeld' && s !== 'klant').map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" className="mt-3 w-full knop-donker">Inschrijven</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
