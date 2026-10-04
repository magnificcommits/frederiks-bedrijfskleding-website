import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getRetourenActief } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getMijnRetouren, getMijnRetourneerbareOrders, getRetourInfo, type Retour, type RetourStatus } from '@/lib/portaal/service';
import PortaalNav from '../PortaalNav';
import RetourFormulier from './RetourFormulier';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Vertaler } from '@/lib/i18n/portaal/kern';
import { STANDAARD_REPARATIETEKST } from '@/lib/kms/service';
import ReparatieFormulier from './ReparatieFormulier';

const REPARATIE_STAPPEN = ['aangemeld', 'ontvangen', 'in_reparatie', 'klaar'] as const;
const REP_MELDING = {
  onderdeel: 'retouren.repFout.onderdeel',
  toelichting: 'retouren.repFout.toelichting',
  kledingstuk: 'retouren.repFout.kledingstuk',
  fout: 'retouren.repFout.fout',
} as const;

/** Voortgang van een reparatie als stappen; de laatste stap is teruggestuurd of opgehaald. */
function ReparatieStappen({ r, v }: { r: Retour; v: Vertaler }) {
  const huidig = r.reparatie_status ?? 'aangemeld';
  const eind = huidig === 'teruggestuurd' || huidig === 'opgehaald';
  const index = eind ? REPARATIE_STAPPEN.length : REPARATIE_STAPPEN.indexOf(huidig as (typeof REPARATIE_STAPPEN)[number]);
  const stappen = [...REPARATIE_STAPPEN.map((s) => v.status('reparatie', s)), eind ? v.status('reparatie', huidig) : v.t('retouren.terugBijJou')];
  return (
    <ol className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label={v.t('retouren.voortgang')}>
      {stappen.map((label, i) => (
        <li
          key={label}
          aria-current={i === index ? 'step' : undefined}
          className={`rounded-full border px-2.5 py-1 font-semibold ${
            i < index || (eind && i === index) ? 'border-green-300 bg-green-50 text-green-800' : i === index ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-line bg-white text-warm'
          }`}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.retouren'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

function StatusBadge({ status, v }: { status: RetourStatus; v: Vertaler }) {
  const label = v.status('retour', status);
  const toon =
    status === 'goedgekeurd' || status === 'verwerkt'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'afgewezen'
        ? 'border-line bg-mist text-warm'
        : 'border-amber-300 bg-amber-50 text-amber-700';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Retouren({ searchParams }: { searchParams: Promise<{ ok?: string; leeg?: string; fout?: string; geenregels?: string; soort?: string; rep?: string }> }) {
  const v = await getVertaler();
  const { t, datum } = v;
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
  const info = await getRetourInfo(org.id);
  const termijn = info.termijn;
  const reparatieAan = info.reparatie.aan;
  const soort = sp?.soort === 'ruilen' ? 'ruilen' : sp?.soort === 'reparatie' && reparatieAan ? 'reparatie' : 'retour';
  const [retouren, orders, toegang, retourenAan, reparatieOrders] = await Promise.all([
    getMijnRetouren(),
    getMijnRetourneerbareOrders(termijn),
    getMijnToegang(),
    getRetourenActief(),
    // Voor een reparatie mag de bestelling ouder zijn dan de retourtermijn.
    soort === 'reparatie' ? getMijnRetourneerbareOrders(365 * 5) : Promise.resolve([]),
  ]);
  const soortLink = (s: string) => `/portaal/retouren${s === 'retour' ? '' : `?soort=${s}`}`;
  const keuzes = [
    { id: 'retour', label: t('retouren.keuzeRetour') },
    { id: 'ruilen', label: t('retouren.keuzeRuilen') },
    ...(reparatieAan ? [{ id: 'reparatie', label: t('retouren.keuzeReparatie') }] : []),
  ];

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{reparatieAan ? t('retouren.titelMetReparatie') : t('nav.retouren')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/retouren" />

      <p className="mt-6 max-w-2xl text-sm text-warm">{t('retouren.intro')}</p>

      <p className="mt-3 max-w-2xl rounded-lg bg-mist px-4 py-3 text-sm text-ink-800">
        <span className="font-semibold">{t('retouren.beleidLabel')}</span> {t('retouren.beleidTekst', { dagen: termijn })}
        {info.voorwaarden.length > 0 && (
          <span className="mt-2 block">
            <span className="font-semibold">{t('retouren.voorwaarden')}</span>
            <span className="mt-1 block">
              {info.voorwaarden.map((v) => (
                <span key={v} className="block">{'- '}{v}</span>
              ))}
            </span>
          </span>
        )}
      </p>

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('retouren.ok')}
        </div>
      )}
      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('retouren.leeg')}
        </div>
      )}
      {sp?.geenregels && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('retouren.geenRegels')}
        </div>
      )}
      {sp?.rep === 'ok' && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('retouren.repOk')}
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('retouren.fout')}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">
              {soort === 'reparatie' ? t('retouren.aanmeldenReparatie') : soort === 'ruilen' ? t('retouren.aanmeldenRuilen') : t('retouren.aanmelden')}
            </h2>
            {retourenAan && keuzes.length > 1 && (
              <nav className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-mist p-1" aria-label={t('retouren.keuzeLabel')}>
                {keuzes.map((k) => (
                  <Link
                    key={k.id}
                    href={soortLink(k.id)}
                    aria-current={soort === k.id ? 'page' : undefined}
                    className={`flex min-h-10 items-center justify-center rounded-md px-2 text-center text-sm font-semibold ${
                      soort === k.id ? 'bg-white text-ink-900 shadow-sm' : 'text-warm hover:text-ink-800'
                    }`}
                  >
                    {k.label}
                  </Link>
                ))}
              </nav>
            )}
            {retourenAan && soort === 'reparatie' ? (
              <>
                {/* Een eigen tekst uit Instellingen blijft zoals hij is; de standaardtekst vertalen we. */}
                <p className="mt-3 text-sm text-warm">{info.reparatie.tekst === STANDAARD_REPARATIETEKST ? t('retouren.repStandaardTekst') : info.reparatie.tekst}</p>
                <ReparatieFormulier
                  orders={reparatieOrders}
                  kosten={info.reparatie.kosten}
                  fout={sp?.rep && Object.prototype.hasOwnProperty.call(REP_MELDING, sp.rep) ? t(REP_MELDING[sp.rep as keyof typeof REP_MELDING]) : null}
                />
              </>
            ) : retourenAan ? (
              <RetourFormulier key={soort} orders={orders} redenen={info.redenen} soort={soort === 'ruilen' ? 'ruilen' : 'retour'} />
            ) : (
              <p className="mt-3 text-sm text-warm">{t('retouren.uitgeschakeld')}</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {retouren.length === 0 ? (
            <p className="text-sm text-warm">{t('retouren.geenRetouren')}</p>
          ) : (
            <div className="space-y-5">
              {retouren.map((r) => (
                <div key={r.id} className="rounded-xl border border-line bg-white p-6 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-900">
                      {r.soort !== 'retour' && (
                        <span className="mr-2 inline-block rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-ink-800">
                          {r.soort === 'reparatie' ? t('retouren.soortReparatie') : t('retouren.soortRuilen')}
                        </span>
                      )}
                      {r.ordernummer ? t('algemeen.order', { nr: r.ordernummer }) : t('retouren.zonderBestelling')} {"·"} {datum(r.created_at)}
                    </p>
                    {r.soort === 'reparatie' ? (
                      <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        {v.status('reparatie', r.reparatie_status ?? 'aangemeld')}
                      </span>
                    ) : (
                      <StatusBadge status={r.status} v={v} />
                    )}
                  </div>
                  {r.soort === 'reparatie' && <ReparatieStappen r={r} v={v} />}
                  {r.soort === 'reparatie' && (r.reparatie_onderdeel || r.reparatie_kosten) && (
                    <p className="mt-2 text-sm text-ink-800">
                      {r.reparatie_onderdeel && <><span className="font-semibold">{t('retouren.kapot')}</span> {v.status('onderdeel', r.reparatie_onderdeel)}</>}
                      {r.reparatie_kosten != null && r.reparatie_kosten > 0 && (
                        <span className="text-warm">
                          {r.reparatie_onderdeel ? ' · ' : ''}{t('retouren.kosten', { bedrag: v.euro(r.reparatie_kosten) })}
                        </span>
                      )}
                    </p>
                  )}

                  {r.regels.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-ink-800">
                      {r.regels.map((rg, i) => (
                        <li key={`${rg.orderregel_id}-${i}`} className="flex flex-wrap gap-1">
                          <span className="font-semibold">{rg.aantal}{'×'}</span>
                          <span>{rg.item_naam}</span>
                          {(rg.maat || rg.kleur) && (
                            <span className="text-warm">{[rg.maat, rg.kleur].filter(Boolean).join(' / ')}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {r.reden && (
                    <p className="mt-3 text-sm text-ink-800"><span className="font-semibold">{t('retouren.redenLabel')}</span> {r.reden}</p>
                  )}

                  {r.retouradres && (
                    <p className="mt-4 rounded-lg bg-mist px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">{t('retouren.retouradres')}</span> {r.retouradres}</p>
                  )}
                  {r.instructie && (
                    <p className="mt-2 rounded-lg bg-mist px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">{t('retouren.instructie')}</span> {r.instructie}</p>
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
