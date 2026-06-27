import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
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

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

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
  const { id } = await params;
  const { ok, aantal } = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/campagnes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar campagnes</Link>
        </div>
      </main>
    );
  }

  const campagne = await getCampagne(id);
  if (!campagne) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Campagne niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze campagne bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/campagnes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar campagnes</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{campagne.naam}</h1>
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
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Stappen</h2>
            <p className="mt-1 text-xs text-warm">In het onderwerp en de body kun je de placeholders <code>{'{{bedrijfsnaam}}'}</code> en <code>{'{{contactpersoon}}'}</code> gebruiken. Die worden bij verzending per prospect ingevuld.</p>

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
                        <label className="block text-xs font-semibold text-warm">Volgorde</label>
                        <input name="volgorde" inputMode="numeric" defaultValue={String(s.volgorde ?? 1)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-warm">Wachttijd (dagen)</label>
                        <input name="wacht_dagen" inputMode="numeric" defaultValue={String(s.wacht_dagen ?? 0)} className={inputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-warm">Onderwerp</label>
                        <input name="onderwerp" required defaultValue={s.onderwerp ?? ''} className={inputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-warm">Bericht</label>
                        <textarea name="body" required rows={5} defaultValue={s.body ?? ''} className={inputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Stap opslaan</button>
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

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Stap toevoegen</h2>
            <form action={voegStapActie} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="campagneId" value={campagne.id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Volgorde</label>
                <input name="volgorde" inputMode="numeric" defaultValue={String(campagne.stappen.length + 1)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Wachttijd (dagen)</label>
                <input name="wacht_dagen" inputMode="numeric" defaultValue="0" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-warm">Onderwerp</label>
                <input name="onderwerp" required placeholder="Bijv. Werkkleding voor {{bedrijfsnaam}}" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-warm">Bericht</label>
                <textarea name="body" required rows={5} placeholder={'Beste {{contactpersoon}},\n\n...'} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Stap toevoegen</button>
              </div>
            </form>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
            <p className="mt-2"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[campagne.status] ?? 'bg-ink-100 text-ink-600'}`}>{campagne.status}</span></p>
            <form action={wijzigCampagneStatusActie} className="mt-4">
              <input type="hidden" name="campagneId" value={campagne.id} />
              <label className="block text-xs font-semibold text-warm">Wijzig status</label>
              <AutoSubmitSelect
                name="status"
                defaultValue={campagne.status}
                aria-label="Campagnestatus"
                className={inputCls}
                options={CAMPAGNE_STATUSSEN.map((s) => ({ value: s, label: s }))}
              />
            </form>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Inschrijvingen</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-warm">Totaal ingeschreven</dt><dd className="text-ink-900">{campagne.aantalInschrijvingen}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Actief</dt><dd className="text-ink-900">{campagne.aantalActief}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Verzonden mails</dt><dd className="text-ink-900">{campagne.aantalVerzonden}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Prospects inschrijven</h2>
            <p className="mt-1 text-xs text-warm">Schrijft prospecten met de gekozen status in. Afgemelde prospecten en klanten worden overgeslagen.</p>
            <form action={schrijfInActie} className="mt-3">
              <input type="hidden" name="campagneId" value={campagne.id} />
              <label className="block text-xs font-semibold text-warm">Prospect-status</label>
              <select name="prospectStatus" className={inputCls} defaultValue="">
                <option value="">Alle prospecten</option>
                {PROSPECT_STATUSSEN.filter((s) => s !== 'afgemeld' && s !== 'klant').map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" className="mt-3 w-full rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Inschrijven</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
