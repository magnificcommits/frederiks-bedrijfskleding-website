import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminSessieStatus, dashAuthed, isWachtwoordLogin, SESSIE_DUUR_SEC } from '@/lib/kms/adminClient';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import KoppelApp from './KoppelApp';
import { ontkoppel } from './actions';

export const metadata: Metadata = { title: 'Beveiliging', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Factor = { id: string; friendly_name?: string | null; created_at: string };

function tijd(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function BeveiligingPagina({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { ok, fout } = await searchParams;
  const status = await adminSessieStatus();
  const wachtwoord = await isWachtwoordLogin();

  let factoren: Factor[] = [];
  if (status.status === 'ok') {
    try {
      const sb = await getServerSupabase('dashboard');
      const { data } = (await sb?.auth.mfa.listFactors()) ?? { data: null };
      factoren = ((data?.totp ?? []) as Factor[]).filter(Boolean);
    } catch {
      factoren = [];
    }
  }

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Beveiliging</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Hier stel je in hoe je veilig inlogt. In de browser blijf je maximaal 8 uur ingelogd. In het KMS als app op je telefoon blijf je ingelogd tot je zelf uitlogt (maximaal 180 dagen).</p>

      {ok === 'ontkoppeld' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">De authenticator-app is ontkoppeld.</p>
      )}
      {fout === 'ontkoppelen' && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">Ontkoppelen is niet gelukt. Probeer het opnieuw.</p>
      )}
      {fout === 'account' && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">Log in met je eigen account (e-maillink) om dit te doen.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-ink-900">Tweestapsverificatie</h2>
          <p className="mt-1 text-sm text-warm">
            Met tweestapsverificatie heb je bij het inloggen naast de e-maillink ook een code uit een app op je telefoon nodig.
            Zo kan niemand inloggen met alleen toegang tot je e-mail.
          </p>

          {status.status !== 'ok' ? (
            <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Je bent nu ingelogd met het gedeelde wachtwoord. Tweestapsverificatie hoort bij een persoonlijk account.
              Log uit en log daarna in met je eigen e-maillink om dit in te stellen.
            </p>
          ) : factoren.length > 0 ? (
            <div className="mt-4">
              <p className="rounded-md bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">Tweestapsverificatie staat aan voor {status.email}.</p>
              <ul className="mt-4 divide-y divide-line rounded-md border border-line">
                {factoren.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{f.friendly_name || 'Authenticator-app'}</p>
                      <p className="text-xs text-warm">Gekoppeld op {tijd(f.created_at)}</p>
                    </div>
                    <form action={ontkoppel}>
                      <input type="hidden" name="factor_id" value={f.id} />
                      <ConfirmSubmit
                        message="Weet je zeker dat je deze app wilt ontkoppelen? Daarna is er bij het inloggen geen code meer nodig."
                        className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-mist"
                      >
                        Ontkoppelen
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4">
              <KoppelApp />
            </div>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Je sessie</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-800">
            {status.status === 'ok' && (
              <li>
                Ingelogd met je eigen account <span className="font-semibold">{status.email}</span> sinds {tijd(status.inlogtijd * 1000)}.
                {status.duur > SESSIE_DUUR_SEC
                  ? <>Op deze telefoon blijf je ingelogd tot je zelf uitlogt (uiterlijk {new Date((status.inlogtijd + status.duur) * 1000).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })}).</>
                  : <>Je wordt automatisch uitgelogd om {tijd((status.inlogtijd + status.duur) * 1000)}.</>}
              </li>
            )}
            {wachtwoord && <li>Ingelogd met het gedeelde wachtwoord (maximaal 8 uur geldig).</li>}
          </ul>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Bescherming bij inloggen</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-800">
            <li>Na 5 verkeerde pogingen binnen 15 minuten wordt inloggen tijdelijk geblokkeerd.</li>
            <li>Wijzigingen worden vastgelegd in het logboek, met wie het deed en wat er veranderde.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
