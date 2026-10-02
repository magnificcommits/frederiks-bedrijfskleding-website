import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Even wachten', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Wordt getoond als er te vaak een verkeerd wachtwoord is ingevuld. */
export default function GeblokkeerdPagina() {
  return (
    <main className="container-smal py-20">
      <div className="mx-auto max-w-sm panel p-5">
        <h1 className="dash-h1">Even wachten</h1>
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          Er is te vaak een verkeerd wachtwoord ingevuld vanaf deze internetverbinding.
          Uit veiligheid is inloggen met het wachtwoord 15 minuten geblokkeerd.
        </p>
        <p className="mt-3 text-sm text-warm">
          Probeer het over een kwartier opnieuw. Heb je een eigen account? Dan kun je ook inloggen met een e-maillink.
        </p>
        <Link href="/dashboard" className="btn-primary mt-5 inline-block w-full text-center">Terug naar inloggen</Link>
      </div>
    </main>
  );
}
