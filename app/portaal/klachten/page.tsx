import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getKlachtCategorieen, getMijnKlachten, getMijnOrders, type KlachtStatus, type KlachtSoort } from '@/lib/portaal/service';
import PortaalNav from '../PortaalNav';
import { reageerKlacht, vraagKlacht } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Vertaler } from '@/lib/i18n/portaal/kern';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.vragenKlachten'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

const veld = 'mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none';
const soortLabel = { vraag: 'klachten.vraag', klacht: 'klachten.klacht' } as const satisfies Record<KlachtSoort, string>;

function StatusBadge({ status, v }: { status: KlachtStatus; v: Vertaler }) {
  const label = v.status('klacht', status);
  const toon =
    status === 'afgehandeld'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'in_behandeling'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-line bg-mist text-warm';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Klachten({ searchParams }: { searchParams: Promise<{ ok?: string; leeg?: string; fout?: string; gereageerd?: string }> }) {
  const v = await getVertaler();
  const { t, datum, moment } = v;
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
  const [klachten, orders, toegang, categorieen] = await Promise.all([getMijnKlachten(), getMijnOrders(), getMijnToegang(), getKlachtCategorieen()]);

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.vragenKlachten')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/klachten" />

      <p className="mt-6 max-w-2xl text-sm text-warm">{t('klachten.intro')}</p>

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('klachten.ok')}
        </div>
      )}
      {sp?.gereageerd && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('klachten.gereageerd')}
        </div>
      )}
      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('klachten.leeg')}
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('algemeen.foutVersturen')}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">{t('klachten.nieuwBericht')}</h2>
            <form action={vraagKlacht} className="mt-4">
              <label htmlFor="soort" className="block text-sm font-semibold text-ink-900">{t('klachten.soort')}</label>
              <select id="soort" name="soort" className={veld} defaultValue="vraag">
                <option value="vraag">{t('klachten.vraag')}</option>
                <option value="klacht">{t('klachten.klacht')}</option>
              </select>

              {categorieen.length > 0 && (
                <>
                  <label htmlFor="categorie" className="mt-4 block text-sm font-semibold text-ink-900">{t('klachten.waarOver')}</label>
                  <select id="categorie" name="categorie" className={veld} defaultValue="">
                    <option value="">{t('klachten.weetNiet')}</option>
                    {categorieen.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}

              <label htmlFor="order_id" className="mt-4 block text-sm font-semibold text-ink-900">{t('klachten.bestellingOptioneel')}</label>
              <select id="order_id" name="order_id" className={veld} defaultValue="">
                <option value="">{t('klachten.geenBestelling')}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.ordernummer ? t('algemeen.order', { nr: o.ordernummer }) : t('algemeen.bestelling')}</option>
                ))}
              </select>

              <label htmlFor="omschrijving" className="mt-4 block text-sm font-semibold text-ink-900">{t('algemeen.omschrijving')}</label>
              <textarea id="omschrijving" name="omschrijving" rows={4} required placeholder={t('klachten.omschrijvingPlaceholder')} className={veld} />

              <button type="submit" className="btn-primary mt-4 w-full justify-center">{t('algemeen.versturen')}</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          {klachten.length === 0 ? (
            <p className="text-sm text-warm">{t('klachten.geenKlachten')}</p>
          ) : (
            <div className="space-y-5">
              {klachten.map((k) => (
                <div key={k.id} className="rounded-xl border border-line bg-white p-6 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-900">
                      {soortLabel[k.soort] ? t(soortLabel[k.soort]) : k.soort}
                      {k.categorie ? ` · ${k.categorie}` : ''}
                      {k.ordernummer ? ` · ${t('klachten.orderKlein', { nr: k.ordernummer })}` : ''} {"·"} {datum(k.created_at)}
                    </p>
                    <StatusBadge status={k.status} v={v} />
                  </div>

                  <p className="mt-3 text-sm text-ink-800">{k.omschrijving}</p>

                  {k.berichten.length > 0 ? (
                    <ol className="mt-4 space-y-2">
                      {k.berichten.map((b) => (
                        <li
                          key={b.id}
                          className={`rounded-lg px-4 py-3 text-sm ${b.soort === 'klant' ? 'ml-6 border border-line bg-white text-ink-800' : 'mr-6 bg-mist text-ink-800'}`}
                        >
                          <p className="text-xs font-semibold text-warm">
                            {b.soort === 'klant' ? t('klachten.jij') : 'Frederiks Bedrijfskleding'} {'·'} {moment(b.created_at)}
                          </p>
                          <p className="mt-1 whitespace-pre-line">{b.tekst}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    k.antwoord && (
                      <p className="mt-4 rounded-lg bg-mist px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">{t('klachten.antwoord')}</span> {k.antwoord}</p>
                    )
                  )}

                  {k.berichten.length > 0 && (
                    <form action={reageerKlacht} className="mt-4">
                      <input type="hidden" name="klacht_id" value={k.id} />
                      <label htmlFor={`reactie-${k.id}`} className="block text-sm font-semibold text-ink-900">{t('klachten.reageren')}</label>
                      <textarea id={`reactie-${k.id}`} name="tekst" rows={2} required placeholder={t('klachten.reactiePlaceholder')} className={veld} />
                      <button type="submit" className="btn-secondary mt-2">{t('klachten.reactieVersturen')}</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
