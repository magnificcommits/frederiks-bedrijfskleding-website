import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getWachtendeOrders } from '@/lib/portaal/goedkeuringen';
import { getSpaarInstellingen, getSpaarsaldo } from '@/lib/kms/sparen';
import { getVertaler } from '@/lib/i18n/portaal/server';
import { portaalLogout, markeerMeldingenGelezenActie } from './actions';
import { listMijnMeldingen } from '@/lib/portaal/verzoeken';
import PortaalNav from './PortaalNav';
import InstalleerApp from '@/components/pwa/InstalleerApp';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('algemeen.klantportaal'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

export default async function Portaal() {
  const { t, tn, rijk, euro: formatEuro } = await getVertaler();
  const euro = (n: number) => formatEuro(n, 0);
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietActiefTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{rijk('algemeen.nietActiefConfig', { url: <code>NEXT_PUBLIC_SUPABASE_URL</code>, key: <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> })}</p>
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
          <form action={portaalLogout} className="mt-5"><button className="text-sm font-semibold text-warm hover:text-ink-800">{t('algemeen.uitloggen')}</button></form>
        </div>
      </main>
    );
  }

  const toegang = await getMijnToegang();
  const magKeuren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';
  const [items, wachtend, spaarInstellingen, meldingen] = await Promise.all([
    getKledinglijn(),
    magKeuren ? getWachtendeOrders() : Promise.resolve([]),
    getSpaarInstellingen(),
    listMijnMeldingen(),
  ]);
  const ongelezen = meldingen.filter((m) => !m.gelezen);
  const spaarsaldo = spaarInstellingen.actief ? await getSpaarsaldo(org.id) : null;
  const spaarMijlpaal = spaarsaldo
    ? (() => {
        const tiers = [5, 10, 25, 50, 100, 250, 500];
        const huidig = spaarsaldo.euroWaarde;
        const target = tiers.find((t) => t > huidig) ?? Math.ceil((huidig + 1) / 100) * 100;
        const vorige = [0, ...tiers].filter((t) => t <= huidig).pop() ?? 0;
        const pct = Math.max(4, Math.min(100, Math.round(((huidig - vorige) / (target - vorige)) * 100)));
        return { target, pct, teGaan: Math.max(0, target - huidig) };
      })()
    : null;

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('home.welkom')}</h1>
          <p className="mt-1 text-sm text-warm">
            {t('home.ingelogdAls', { email: user.email ?? '' })}
            {toegang.rol ? ` · ${t(`rol.${toegang.rol}`)}` : ''}
          </p>
        </div>
        <Link href="/portaal/webshop" className="btn-primary">{t('nav.kledingBestellen')}</Link>
      </div>

      <PortaalNav rol={toegang.rol} actief="/portaal" />

      <InstalleerApp gebied="portaal" variant="blok" uitlegHref="/portaal/app" />

      {ongelezen.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">{t('home.berichten')}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-800">
                {ongelezen.map((m) => <li key={m.id}>{m.tekst}</li>)}
              </ul>
            </div>
            <form action={markeerMeldingenGelezenActie}>
              <button type="submit" className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">{t('home.gelezen')}</button>
            </form>
          </div>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">{t('home.zoBestelJe')}</p>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 font-display text-sm font-extrabold text-amber-700" aria-hidden="true">1</span>
            <div>
              <p className="font-semibold text-ink-900">{t('home.stap1Titel')}</p>
              <p className="mt-0.5 text-sm text-warm">{t('home.stap1Tekst')}</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 font-display text-sm font-extrabold text-amber-700" aria-hidden="true">2</span>
            <div>
              <p className="font-semibold text-ink-900">{t('home.stap2Titel')}</p>
              <p className="mt-0.5 text-sm text-warm">{t('home.stap2Tekst')}</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 font-display text-sm font-extrabold text-amber-700" aria-hidden="true">3</span>
            <div>
              <p className="font-semibold text-ink-900">{t('home.stap3Titel')}</p>
              <p className="mt-0.5 text-sm text-warm">{t('home.stap3Tekst')}</p>
            </div>
          </li>
        </ol>
      </section>

      {spaarsaldo && spaarMijlpaal && (
        <section className="mt-8 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50 to-white p-6 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">{t('home.spaarvoordeel')}</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink-900">
                {formatEuro(spaarsaldo.euroWaarde)} <span className="text-base font-bold text-warm">{t('home.kortingGespaard')}</span>
              </p>
              <p className="mt-1 text-sm text-warm">
                {tn('algemeen.punten', Math.round(spaarsaldo.saldo))} &middot; {t('home.inTeZetten')}
              </p>
            </div>
            <Link href="/portaal/webshop" className="btn-primary shrink-0">{t('home.bestelEnSpaar')}</Link>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-800">{t('home.volgendeMijlpaal')}</span>
              <span className="text-warm">{t('home.mijlpaalKorting', { bedrag: formatEuro(spaarMijlpaal.target) })}</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-amber-100">
              <div className="h-3 rounded-full bg-amber-500 transition-all" style={{ width: `${spaarMijlpaal.pct}%` }} aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm text-ink-700">
              {rijk('home.nogTeGaan', { bedrag: <strong className="text-ink-900">{formatEuro(spaarMijlpaal.teGaan)}</strong>, doel: formatEuro(spaarMijlpaal.target) })}
            </p>
          </div>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/portaal/webshop" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
          <p className="font-display text-lg font-extrabold text-ink-900">{t('nav.kledingBestellen')}</p>
          <p className="mt-1 text-sm text-warm">{t('home.kaartBestellenTekst')}</p>
        </Link>
        <Link href="/portaal/bestellingen" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
          <p className="font-display text-lg font-extrabold text-ink-900">{t('nav.mijnBestellingen')}</p>
          <p className="mt-1 text-sm text-warm">{t('home.kaartBestellingenTekst')}</p>
        </Link>
        {magKeuren && (
          <Link href="/portaal/goedkeuringen" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">{t('nav.goedkeuringen')}</p>
            <p className="mt-1 text-sm text-warm">
              {wachtend.length > 0
                ? tn('home.goedkeuringenWachten', wachtend.length)
                : t('home.geenGoedkeuringen')}
            </p>
          </Link>
        )}
        {magKeuren && (
          <Link href="/portaal/medewerkers" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">{t('nav.medewerkers')}</p>
            <p className="mt-1 text-sm text-warm">{t('home.kaartMedewerkersTekst')}</p>
          </Link>
        )}
        {magKeuren && (
          <Link href="/portaal/facturen" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">{t('nav.facturen')}</p>
            <p className="mt-1 text-sm text-warm">{t('home.kaartFacturenTekst')}</p>
          </Link>
        )}
      </div>

      <h2 className="mt-12 font-display text-xl font-extrabold text-ink-900">{t('home.kledinglijn')}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-warm">{t('home.geenKledinglijn')}</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Link
              key={i.id}
              href="/portaal/webshop"
              className="group flex flex-col rounded-xl border border-line bg-white p-5 shadow-soft transition hover:border-amber-300 hover:shadow-md"
            >
              <p className="font-bold text-ink-900">{i.naam}</p>
              <p className="mt-1 text-sm text-warm">{[i.merk, i.kleur].filter(Boolean).join(' · ') || t('algemeen.geenDetails')}</p>
              <p className="mt-1 text-xs text-warm">{t('home.logo', { positie: i.logopositie || t('home.nogTeBepalen') })}{i.techniek ? ` · ${i.techniek}` : ''}</p>
              {i.richtprijs != null && <p className="mt-2 text-sm font-semibold text-ink-700">{euro(Number(i.richtprijs))}</p>}
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                {t('home.bestellen')}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
