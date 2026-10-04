import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn, getMedewerkers, getMatenMap } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import PortaalNav from '../PortaalNav';
import { vraagHerbestelling } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.herbestellen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

export default async function Herbestellen({ searchParams }: { searchParams: Promise<{ leeg?: string; fout?: string; voor?: string }> }) {
  const { t } = await getVertaler();
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietActiefTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietActiefTekst')}</p>
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
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietGekoppeldTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietGekoppeldTekst', { email: user.email ?? '' })}</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const [items, medewerkers, toegang] = await Promise.all([getKledinglijn(), getMedewerkers(), getMijnToegang()]);
  const maten = sp?.voor ? await getMatenMap(sp.voor) : {};
  const gekozen = medewerkers.find((m) => m.id === sp?.voor);

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.herbestellen')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/herbestellen" />

      <p className="mt-6 max-w-2xl text-sm text-warm">{t('herbestellen.intro')}</p>

      {medewerkers.length > 0 && (
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="voor" className="block text-xs font-semibold text-warm">{t('herbestellen.matenVoor')}</label>
            <select id="voor" name="voor" defaultValue={sp?.voor ?? ''} className="mt-1 rounded-lg border border-line px-3 py-2 text-sm">
              <option value="">{t('herbestellen.kiesMedewerker')}</option>
              {medewerkers.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">{t('herbestellen.matenOphalen')}</button>
          {gekozen && <span className="py-2 text-sm text-warm">{t('herbestellen.matenIngevuld', { naam: gekozen.naam })}</span>}
        </form>
      )}

      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('herbestellen.leeg')}
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('algemeen.foutVersturen')}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-warm">{t('herbestellen.geenKledinglijn')}</p>
      ) : (
        <form action={vraagHerbestelling} className="mt-8 max-w-3xl">
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
            {items.map((i, idx) => (
              <div key={i.id} className={`flex flex-wrap items-end gap-4 p-5 ${idx > 0 ? 'border-t border-line' : ''}`}>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-bold text-ink-900">{i.naam}</p>
                  <p className="mt-1 text-sm text-warm">{[i.merk, i.kleur].filter(Boolean).join(' · ') || t('algemeen.geenDetails')}</p>
                </div>
                <div>
                  <label htmlFor={`maat_${i.id}`} className="block text-xs font-semibold text-warm">{t('algemeen.maat')}</label>
                  <input id={`maat_${i.id}`} name={`maat_${i.id}`} type="text" placeholder={t('herbestellen.maatPlaceholder')} defaultValue={maten[i.id] ?? ''}
                    className="mt-1 w-24 rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor={`aantal_${i.id}`} className="block text-xs font-semibold text-warm">{t('algemeen.aantal')}</label>
                  <input id={`aantal_${i.id}`} name={`aantal_${i.id}`} type="number" min={0} step={1} defaultValue={0}
                    className="mt-1 w-24 rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label htmlFor="notitie" className="block text-sm font-semibold text-ink-900">{t('algemeen.opmerkingOptioneel')}</label>
            <textarea id="notitie" name="notitie" rows={3} placeholder={t('herbestellen.notitiePlaceholder')}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none" />
          </div>

          <button type="submit" className="btn-primary mt-6">{t('herbestellen.versturen')}</button>
        </form>
      )}
    </main>
  );
}
