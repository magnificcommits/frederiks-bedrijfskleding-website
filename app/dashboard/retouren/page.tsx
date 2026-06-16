import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import {
  listRetouren,
  listOrganisaties,
  RETOUR_STATUSSEN,
  type RetourMetLabels,
} from '@/lib/kms/service';
import { nieuwRetour, wijzigRetourStatus, wijzigRetourInstructie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Retouren', robots: { index: false, follow: false } };

function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const retourBadge: Record<string, string> = {
  aangemeld: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-ink-100 text-ink-700',
  afgewezen: 'bg-red-100 text-red-700',
  verwerkt: 'bg-green-100 text-green-800',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

export default async function RetourenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { status } = await searchParams;
  const actief = status && (RETOUR_STATUSSEN as readonly string[]).includes(status) ? status : '';
  const [retouren, orgs] = await Promise.all([listRetouren(actief || undefined), listOrganisaties()]);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Retouren</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Aangemelde retouren beoordeel je hier en je legt het retouradres en de instructie voor de klant vast.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-warm">Filter</span>
        <Link
          href="/dashboard/retouren"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${actief === '' ? 'bg-ink-900 text-white' : 'bg-mist text-warm hover:text-ink-800'}`}
        >
          Alle
        </Link>
        {RETOUR_STATUSSEN.map((s) => (
          <Link
            key={s}
            href={`/dashboard/retouren?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${actief === s ? 'bg-ink-900 text-white' : 'bg-mist text-warm hover:text-ink-800'}`}
          >
            {statusLabel(s)}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {retouren.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen retouren in deze weergave.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {retouren.map((r) => (
                <RetourKaart key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Retour aanmelden</h2>
          <p className="mt-1 text-xs text-warm">Meld hier handmatig een retour aan. Medewerkers kunnen dit straks zelf vanuit het portaal doen.</p>
          <form action={nieuwRetour} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Klant</label>
              <select name="organisatie_id" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                <option value="">Geen klant gekoppeld</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.naam}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Reden</label>
              <textarea name="reden" rows={3} placeholder="Bijvoorbeeld: verkeerde maat geleverd" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Retour aanmelden</button>
          </form>
        </div>
      </div>
    </main>
  );
}

function RetourKaart({ r }: { r: RetourMetLabels }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-ink-900">{r.organisatie_naam || 'Onbekende klant'}</p>
          <p className="mt-0.5 text-xs text-warm">
            Aangemeld op {fmt(r.created_at)}{r.ordernummer ? ` · order ${r.ordernummer}` : ''}
          </p>
        </div>
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${retourBadge[r.status] ?? 'bg-ink-100 text-ink-600'}`}>{statusLabel(r.status)}</span>
      </div>

      {r.reden && <p className="mt-3 text-sm text-ink-800">{r.reden}</p>}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {RETOUR_STATUSSEN.filter((s) => s !== r.status).map((s) => (
          <form key={s} action={wijzigRetourStatus}>
            <input type="hidden" name="retourId" value={r.id} />
            <input type="hidden" name="status" value={s} />
            <button type="submit" className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-warm hover:bg-ink-100 hover:text-ink-800">
              Markeer als {statusLabel(s)}
            </button>
          </form>
        ))}
      </div>

      <form action={wijzigRetourInstructie} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="retourId" value={r.id} />
        <div>
          <label className="block text-xs font-semibold text-warm">Retouradres</label>
          <input name="retouradres" defaultValue={r.retouradres ?? ''} placeholder="Adres waar de klant naartoe stuurt" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-warm">Instructie voor de klant</label>
          <textarea name="instructie" rows={2} defaultValue={r.instructie ?? ''} placeholder="Bijvoorbeeld: stuur in originele verpakking, vermeld het ordernummer" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <button type="submit" className="self-start rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
      </form>
    </div>
  );
}
