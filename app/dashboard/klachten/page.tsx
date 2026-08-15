import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import StatusChips from '@/components/dashboard/StatusChips';
import { telPerStatus } from '@/lib/kms/tellingen';
import {
  listKlachten,
  listOrganisaties,
  KLACHT_STATUSSEN,
  KLACHT_SOORTEN,
  type KlachtMetLabels,
} from '@/lib/kms/service';
import { nieuweKlacht, wijzigKlachtStatus, klachtAntwoord } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klachten en vragen', robots: { index: false, follow: false } };

function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const klachtBadge: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_behandeling: 'bg-ink-100 text-ink-700',
  afgehandeld: 'bg-green-100 text-green-800',
};

const soortBadge: Record<string, string> = {
  vraag: 'bg-ink-100 text-ink-700',
  klacht: 'bg-red-100 text-red-700',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

export default async function KlachtenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { status } = await searchParams;
  const actief = status && (KLACHT_STATUSSEN as readonly string[]).includes(status) ? status : '';
  const [klachten, orgs] = await Promise.all([listKlachten(actief || undefined), listOrganisaties()]);

  const perStatus = await telPerStatus('klachten');
  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Klachten en vragen</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Vraag of klacht toevoegen"
            titel="Vraag of klacht toevoegen"
            beschrijving="Leg hier handmatig een vraag of klacht vast, bijvoorbeeld na telefonisch contact. Medewerkers kunnen dit straks zelf vanuit het portaal doen."
            >
            <form action={nieuweKlacht} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="veld-label">Klant</label>
                  <select name="organisatie_id" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    <option value="">Geen klant gekoppeld</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.naam}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="veld-label">Soort</label>
                  <select name="soort" defaultValue="vraag" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {KLACHT_SOORTEN.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="veld-label">Omschrijving</label>
                  <textarea name="omschrijving" required rows={3} placeholder="Waar gaat de vraag of klacht over?" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </div>
                <button type="submit" className="self-start knop-donker">Toevoegen</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Vragen en klachten van klanten beantwoord je hier en je houdt de status bij tot ze afgehandeld zijn.</p>

      <StatusChips
        basePath="/dashboard/klachten"
        huidig={actief}
        statussen={KLACHT_STATUSSEN}
        aantallen={perStatus}
      />

        {klachten.length === 0 ? (
          <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen klachten of vragen in deze weergave.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {klachten.map((k) => (
              <KlachtKaart key={k.id} k={k} />
            ))}
          </div>
        )}
    </main>
  );
}

function KlachtKaart({ k }: { k: KlachtMetLabels }) {
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${soortBadge[k.soort] ?? 'bg-ink-100 text-ink-600'}`}>{k.soort}</span>
            <p className="font-display text-base font-bold text-ink-900">{k.organisatie_naam || 'Onbekende klant'}</p>
          </div>
          <p className="mt-0.5 text-xs text-warm">
            Binnengekomen op {fmt(k.created_at)}{k.ordernummer ? ` · order ${k.ordernummer}` : ''}
          </p>
        </div>
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${klachtBadge[k.status] ?? 'bg-ink-100 text-ink-600'}`}>{statusLabel(k.status)}</span>
      </div>

      <p className="mt-3 text-sm text-ink-800">{k.omschrijving}</p>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {KLACHT_STATUSSEN.filter((s) => s !== k.status).map((s) => (
          <form key={s} action={wijzigKlachtStatus}>
            <input type="hidden" name="klachtId" value={k.id} />
            <input type="hidden" name="status" value={s} />
            <button type="submit" className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-warm hover:bg-ink-100 hover:text-ink-800">
              Markeer als {statusLabel(s)}
            </button>
          </form>
        ))}
      </div>

      <form action={klachtAntwoord} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="klachtId" value={k.id} />
        <div>
          <label className="veld-label">Antwoord</label>
          <textarea name="antwoord" rows={3} defaultValue={k.antwoord ?? ''} placeholder="Het antwoord dat naar de klant gaat" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <button type="submit" className="self-start rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">Antwoord opslaan</button>
      </form>
    </div>
  );
}
