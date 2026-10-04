import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import InstalleerApp, { IosStappen } from '@/components/pwa/InstalleerApp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'KMS als app', robots: { index: false, follow: false } };

/** Uitleg voor Jessi en Tim: het KMS als app op telefoon, tablet of computer. */
export default async function KmsAppUitleg() {
  if (!(await dashAuthed())) redirect('/dashboard');

  return (
    <main className="container-smal py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">KMS als app</h1>
        <Link href="/dashboard/instellingen" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar instellingen</Link>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-warm">
        Zet het KMS als app op je telefoon, tablet of computer. Het opent dan in een eigen venster met het FB-icoon, los van het klantportaal. Gegevens blijven online; klantgegevens worden niet op het apparaat bewaard.
      </p>

      <div className="mt-5 max-w-2xl">
        <InstalleerApp gebied="kms" variant="pagina" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">iPhone en iPad</h2>
          <p className="mt-1 text-xs text-warm">In Safari, op een pagina van het KMS.</p>
          <div className="mt-3 text-[13px] text-ink-800"><IosStappen /></div>
          <p className="mt-3 rounded-md bg-mist px-3 py-2 text-[13px] text-ink-800">
            Inloggen in de app: vraag de inlogmail aan en vul de code uit de mail in. De link in de mail opent Safari, niet de app. Het wachtwoord werkt ook.
          </p>
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Android</h2>
          <p className="mt-1 text-xs text-warm">In Chrome.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] text-ink-800">
            <li>Tik op <span className="font-semibold">Installeer als app</span> onderaan het menu, of op de drie puntjes (⋮) en dan <span className="font-semibold">App installeren</span>.</li>
            <li>Bevestig met <span className="font-semibold">Installeren</span>.</li>
          </ol>
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Computer</h2>
          <p className="mt-1 text-xs text-warm">In Chrome of Edge.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] text-ink-800">
            <li>Klik op het installatie-icoon rechts in de adresbalk, of op <span className="font-semibold">Installeer als app</span> onderaan het menu.</li>
            <li>Het KMS opent in een eigen venster. Snelkoppelingen (rechtsklik op het icoon): Nieuwe offerte, Orders, Taken.</li>
          </ol>
        </section>
      </div>

      <section className="panel mt-4 max-w-2xl p-4">
        <h2 className="font-display text-base font-bold text-ink-900">Klanten het portaal als app laten gebruiken</h2>
        <p className="mt-1 text-[13px] text-warm">
          Stuur klanten de link naar de uitlegpagina. Die werkt ook als ze nog niet ingelogd zijn.
        </p>
        <Link href="/portaal/app" className="mt-3 inline-block knop-stil">Uitlegpagina voor klanten openen</Link>
      </section>
    </main>
  );
}
