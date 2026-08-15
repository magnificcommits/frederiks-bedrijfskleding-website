import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import StatusChips from '@/components/dashboard/StatusChips';
import { telPerStatus } from '@/lib/kms/tellingen';
import {
  listRetouren,
  listOrganisaties,
  RETOUR_STATUSSEN,
  type RetourMetLabels,
} from '@/lib/kms/service';
import { getRetourtermijn, type RetourRegel } from '@/lib/portaal/service';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import { nieuwRetour, wijzigRetourStatus, wijzigRetourInstructie, zetRetourbeleid } from './actions';

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

/** Maakt van de ruwe JSON-kolom `regels` een net getypeerde array. */
function leesRegels(raw: unknown): RetourRegel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const aantal = Number(o.aantal);
      return {
        orderregel_id: String(o.orderregel_id ?? ''),
        item_naam: String(o.item_naam ?? ''),
        maat: o.maat == null ? null : String(o.maat),
        kleur: o.kleur == null ? null : String(o.kleur),
        aantal: Number.isFinite(aantal) && aantal > 0 ? aantal : 1,
      };
    })
    .filter((r) => r.item_naam !== '');
}

export default async function RetourenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string }>;
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

  const { status, ok } = await searchParams;
  const actief = status && (RETOUR_STATUSSEN as readonly string[]).includes(status) ? status : '';
  const [retouren, orgs, termijn] = await Promise.all([
    listRetouren(actief || undefined),
    listOrganisaties(),
    getRetourtermijn(),
  ]);

  // Geretourneerde artikelen (regels JSON) per retour ophalen via de service-role client.
  const { data: regelData } = await sb.from('retouren').select('id, regels');
  const regelsPerRetour = new Map<string, RetourRegel[]>(
    ((regelData as { id: string; regels: unknown }[]) ?? []).map((r) => [r.id, leesRegels(r.regels)]),
  );

  const perStatus = await telPerStatus('retouren');
  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Retouren</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Retour aanmelden"
            titel="Retour aanmelden"
            beschrijving="Meld hier handmatig een retour aan. Medewerkers kunnen dit straks zelf vanuit het portaal doen."
            >
            <form action={nieuwRetour} className="mt-4 flex flex-col gap-3">
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
                  <label className="veld-label">Reden</label>
                  <textarea name="reden" rows={3} placeholder="Bijvoorbeeld: verkeerde maat geleverd" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </div>
                <button type="submit" className="self-start knop-donker">Retour aanmelden</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Aangemelde retouren beoordeel je hier en je legt het retouradres en de instructie voor de klant vast.</p>

      {ok === 'beleid' && (
        <div className="mt-4 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Het retourbeleid is opgeslagen.
        </div>
      )}


      <div className="mt-6 panel p-4">
        <h2 className="font-display text-lg font-bold text-ink-900">Retourbeleid</h2>
        <p className="mt-1 text-xs text-warm">Tot zoveel dagen na de besteldatum kunnen klanten retourneren. Daarna kunnen ze geen retour meer aanmelden.</p>
        <form action={zetRetourbeleid} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="retourtermijn" className="block text-xs font-semibold text-warm">Retourtermijn (dagen)</label>
            <input
              id="retourtermijn"
              name="dagen"
              type="number"
              min={1}
              defaultValue={termijn}
              className="mt-1 w-32 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button type="submit" className="knop-donker">Opslaan</button>
        </form>
      </div>

      <StatusChips
        basePath="/dashboard/retouren"
        huidig={actief}
        statussen={RETOUR_STATUSSEN}
        aantallen={perStatus}
      />

        {retouren.length === 0 ? (
          <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen retouren in deze weergave.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {retouren.map((r) => (
              <RetourKaart key={r.id} r={r} regels={regelsPerRetour.get(r.id) ?? []} />
            ))}
          </div>
        )}
    </main>
  );
}

function RetourKaart({ r, regels }: { r: RetourMetLabels; regels: RetourRegel[] }) {
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-ink-900">{r.organisatie_naam || 'Onbekende klant'}</p>
          <p className="mt-0.5 text-xs text-warm">
            Aangemeld op {fmt(r.created_at)}{r.ordernummer ? ` · order ${r.ordernummer}` : ''}
          </p>
        </div>
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${retourBadge[r.status] ?? 'bg-ink-100 text-ink-600'}`}>{statusLabel(r.status)}</span>
      </div>

      {regels.length > 0 && (
        <div className="mt-3 rounded-lg bg-mist px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Geretourneerde artikelen</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-800">
            {regels.map((rg, i) => (
              <li key={`${rg.orderregel_id}-${i}`} className="flex flex-wrap gap-1">
                <span className="font-semibold">{rg.aantal}{'×'}</span>
                <span>{rg.item_naam}</span>
                {(rg.maat || rg.kleur) && (
                  <span className="text-warm">{[rg.maat, rg.kleur].filter(Boolean).join(' / ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.reden && <p className="mt-3 text-sm text-ink-800">{r.reden}</p>}

      <form action={wijzigRetourStatus} className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input type="hidden" name="retourId" value={r.id} />
        <label className="text-xs font-semibold text-warm">Status</label>
        <AutoSubmitSelect
          name="status"
          defaultValue={r.status}
          aria-label="Status"
          className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          options={RETOUR_STATUSSEN.map((s) => ({ value: s, label: statusLabel(s) }))}
        />
      </form>

      <form action={wijzigRetourInstructie} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="retourId" value={r.id} />
        <div>
          <label className="veld-label">Retouradres</label>
          <input name="retouradres" defaultValue={r.retouradres ?? ''} placeholder="Adres waar de klant naartoe stuurt" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <div>
          <label className="veld-label">Instructie voor de klant</label>
          <textarea name="instructie" rows={2} defaultValue={r.instructie ?? ''} placeholder="Bijvoorbeeld: stuur in originele verpakking, vermeld het ordernummer" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <button type="submit" className="self-start rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
      </form>
    </div>
  );
}
