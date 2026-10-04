import Link from 'next/link';
import type { Metadata } from 'next';
import InstalleerApp, { IosStappen } from '@/components/pwa/InstalleerApp';

export const metadata: Metadata = {
  title: 'Het portaal als app',
  description: 'Zo zet je het kledingportaal van Frederiks Bedrijfskleding op je telefoon of computer.',
  robots: { index: false, follow: false },
};

/**
 * Uitleg voor klanten: het portaal op het beginscherm zetten. Werkt ook zonder
 * inloggen, zodat Frederiks deze link gewoon kan mailen of appen.
 */
export default function PortaalAppUitleg() {
  return (
    <main className="container-x py-10 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">Kledingportaal</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">Zet het portaal op je telefoon</h1>
        <p className="mt-3 text-sm leading-relaxed text-warm">
          Dan staat er een icoon van Frederiks op je beginscherm. Eén tik en je zit in het portaal: kleding bestellen, je bestellingen volgen en je maten bekijken. Er komt niets uit een app store en het kost geen opslagruimte.
        </p>

        <div className="mt-6">
          <InstalleerApp gebied="portaal" variant="pagina" />
        </div>

        <div className="mt-6 grid gap-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">iPhone en iPad</h2>
            <p className="mt-1 text-sm text-warm">Open deze pagina in Safari.</p>
            <div className="mt-3 text-sm text-ink-800">
              <IosStappen />
            </div>
            <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-sm text-ink-800">
              <span className="font-semibold">Inloggen in de app:</span> vraag in de app een inlogmail aan en vul de code uit die mail in. Tik niet op de link in de mail; die opent Safari en niet de app.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Android</h2>
            <p className="mt-1 text-sm text-warm">Open deze pagina in Chrome.</p>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-ink-800">
              <li>Tik op <span className="font-semibold">Installeer als app</span> hierboven of in het portaal.</li>
              <li>Zie je die knop niet? Tik rechtsboven op de drie puntjes (<span className="font-semibold">⋮</span>) en kies <span className="font-semibold">App installeren</span> of <span className="font-semibold">Toevoegen aan startscherm</span>.</li>
              <li>Bevestig met <span className="font-semibold">Installeren</span>.</li>
            </ol>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Computer</h2>
            <p className="mt-1 text-sm text-warm">In Chrome of Edge.</p>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-ink-800">
              <li>Klik rechts in de adresbalk op het installatie-icoon (een schermpje met een pijl), of op <span className="font-semibold">Installeer als app</span> hierboven.</li>
              <li>Klik op <span className="font-semibold">Installeren</span>. Het portaal opent dan in een eigen venster en staat in je startmenu of Dock.</li>
            </ol>
            <p className="mt-3 text-sm text-warm">Op een Mac met Safari: menu Archief, dan <span className="font-semibold">Voeg toe aan Dock</span>.</p>
          </section>
        </div>

        <p className="mt-6 text-sm text-warm">
          Lukt het niet? Bel of mail ons gerust, dan lopen we het samen door. <Link href="/portaal" className="font-semibold text-amber-700 hover:text-amber-800">Naar het portaal</Link>
        </p>
      </div>
    </main>
  );
}
