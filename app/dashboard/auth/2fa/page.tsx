import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminSessieStatus } from '@/lib/kms/adminClient';
import { logout } from '../../actions';
import { bevestigTweeStap } from './actions';

export const metadata: Metadata = { title: 'Inlogcode', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const meldingen: Record<string, string> = {
  code: 'Deze code klopt niet. Kijk in je authenticator-app en probeer het opnieuw. Let op: de code verandert elke 30 seconden.',
  formaat: 'Vul de 6 cijfers uit je authenticator-app in.',
  geblokkeerd: 'Er is te vaak een verkeerde code ingevuld. Wacht 15 minuten en probeer het dan opnieuw.',
};

export default async function TweeStapPagina({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  const { fout } = await searchParams;
  const status = await adminSessieStatus();
  if (status.status === 'ok') redirect('/dashboard');
  if (status.status !== '2fa-nodig') redirect('/dashboard');

  return (
    <main className="container-smal py-20">
      <div className="mx-auto max-w-sm panel p-5">
        <h1 className="dash-h1">Inlogcode invoeren</h1>
        <p className="mt-2 text-sm text-warm">
          Je bent bijna ingelogd als <span className="break-all font-semibold text-ink-900">{status.email}</span>.
          Open de authenticator-app op je telefoon en vul de 6 cijfers in die bij Frederiks KMS staan.
        </p>

        {fout && meldingen[fout] && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{meldingen[fout]}</p>
        )}

        <form action={bevestigTweeStap} className="mt-5">
          <label htmlFor="code" className="veld-label">Code uit de app</label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            autoComplete="one-time-code"
            maxLength={7}
            required
            autoFocus
            placeholder="123456"
            className="w-full rounded-md border border-line bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <button type="submit" className="btn-primary mt-4 w-full">Inloggen</button>
        </form>

        <form action={logout} className="mt-4 border-t border-line pt-4">
          <button type="submit" className="text-sm font-semibold text-warm hover:text-ink-800">Annuleren en uitloggen</button>
        </form>
        <p className="mt-3 text-xs text-warm">
          Telefoon kwijt of werkt de app niet? Vraag een eigenaar om je tweestapsverificatie uit te zetten onder Beheerders. Daarna kun je de app opnieuw koppelen.
        </p>
      </div>
    </main>
  );
}
