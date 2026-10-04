import Link from 'next/link';
import type { Metadata } from 'next';
import InstalleerApp, { IosStappen } from '@/components/pwa/InstalleerApp';
import { getVertaler } from '@/lib/i18n/portaal/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return {
    title: t('app.metaTitel'),
    description: t('app.metaOmschrijving'),
    robots: { index: false, follow: false },
  };
}

/**
 * Uitleg voor klanten: het portaal op het beginscherm zetten. Werkt ook zonder
 * inloggen, zodat Frederiks deze link gewoon kan mailen of appen.
 */
export default async function PortaalAppUitleg() {
  const { t, rijk } = await getVertaler();
  const vet = (tekst: string) => <span className="font-semibold">{tekst}</span>;
  return (
    <main className="container-x py-10 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">{t('app.kicker')}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">{t('installeer.titel')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-warm">
          {t('app.intro')}
        </p>

        <div className="mt-6">
          <InstalleerApp gebied="portaal" variant="pagina" />
        </div>

        <div className="mt-6 grid gap-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">{t('app.iphoneTitel')}</h2>
            <p className="mt-1 text-sm text-warm">{t('app.iphoneBrowser')}</p>
            <div className="mt-3 text-sm text-ink-800">
              <IosStappen />
            </div>
            <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-sm text-ink-800">
              <span className="font-semibold">{t('app.inloggenLabel')}</span> {t('app.inloggenTekst')}
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">{t('app.androidTitel')}</h2>
            <p className="mt-1 text-sm text-warm">{t('app.androidBrowser')}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-ink-800">
              <li>{rijk('app.android1', { knop: vet(t('installeer.knop')) })}</li>
              <li>{rijk('app.android2', { puntjes: vet('⋮'), a: vet(t('app.android2a')), b: vet(t('app.android2b')) })}</li>
              <li>{rijk('app.android3', { knop: vet(t('app.installeren')) })}</li>
            </ol>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">{t('app.computerTitel')}</h2>
            <p className="mt-1 text-sm text-warm">{t('app.computerBrowser')}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-ink-800">
              <li>{rijk('app.computer1', { knop: vet(t('installeer.knop')) })}</li>
              <li>{rijk('app.computer2', { knop: vet(t('app.installeren')) })}</li>
            </ol>
            <p className="mt-3 text-sm text-warm">{rijk('app.mac', { menu: t('app.macMenu'), knop: vet(t('app.macKnop')) })}</p>
          </section>
        </div>

        <p className="mt-6 text-sm text-warm">
          {t('app.hulp')} <Link href="/portaal" className="font-semibold text-amber-700 hover:text-amber-800">{t('app.naarPortaal')}</Link>
        </p>
      </div>
    </main>
  );
}
