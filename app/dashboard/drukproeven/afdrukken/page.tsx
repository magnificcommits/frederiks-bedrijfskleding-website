import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { listDrukproevenOpIds } from '@/lib/kms/drukproeven';
import EmptyState from '@/components/dashboard/EmptyState';
import { site } from '@/content/site';
import DrukproefPreview from '../DrukproefPreview';
import PrintKnop from '../PrintKnop';
import AfdrukStijl from '../AfdrukStijl';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drukproef afdrukken', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vandaag = () => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

/**
 * Afdrukvel (A4) met een of meer drukproeven van één klant, voor de productie of om
 * op papier te laten aftekenen. Zonder aangevinkte proeven komen ze allemaal erop.
 */
export default async function DrukproevenAfdrukkenPage({ searchParams }: { searchParams: Promise<{ org?: string; id?: string | string[] }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { org, id } = await searchParams;
  const sb = kmsAdmin();
  if (!sb || !org || !UUID.test(org)) redirect('/dashboard/drukproeven');

  const ids = (Array.isArray(id) ? id : id ? [id] : []).filter((x) => UUID.test(x));
  const [{ data: klantData }, proeven] = await Promise.all([
    sb.from('organisaties').select('naam, plaats').eq('id', org).maybeSingle(),
    listDrukproevenOpIds(org, ids),
  ]);
  const klant = klantData as { naam: string; plaats: string | null } | null;

  const productIds = [...new Set(proeven.map((p) => p.product_id).filter((v): v is string => Boolean(v)))];
  const artikelNaam = new Map<string, string>();
  if (productIds.length > 0) {
    const { data } = await sb.from('producten').select('id, naam, merk, sku').in('id', productIds);
    for (const p of (data as { id: string; naam: string | null; merk: string | null; sku: string | null }[]) ?? []) {
      artikelNaam.set(p.id, [p.merk, p.naam, p.sku ? `(art. ${p.sku})` : null].filter(Boolean).join(' '));
    }
  }

  return (
    <main className="container-smal py-6">
      <AfdrukStijl doelId="drukproef-afdruk" />
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="dash-h1">Afdrukvel drukproeven</h1>
          <p className="dash-sub">{proeven.length} drukproef{proeven.length === 1 ? '' : 'en'} voor {klant?.naam ?? 'onbekende klant'}. Gebruik A4 staand.</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop tekst="Afdrukken" />
          <Link href={`/dashboard/drukproeven?org=${org}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar drukproeven</Link>
        </div>
      </div>

      {proeven.length === 0 ? (
        <div className="mt-8">
          <EmptyState tekst="Er zijn geen drukproeven om af te drukken." actieHref={`/dashboard/drukproeven?org=${org}`} actieLabel="Terug naar drukproeven" />
        </div>
      ) : (
        <div id="drukproef-afdruk" className="mt-6 rounded-lg border border-line bg-white p-8">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
            <div>
              <div className="font-display text-xl font-extrabold tracking-wide text-ink-900">FREDERIKS</div>
              <div className="text-[10px] font-bold tracking-[0.32em] text-amber-700">BEDRIJFSKLEDING</div>
            </div>
            <div className="text-right text-sm">
              <p className="font-display text-lg font-bold text-ink-900">Drukproef</p>
              <p className="text-ink-800">{klant?.naam}{klant?.plaats ? `, ${klant.plaats}` : ''}</p>
              <p className="text-warm">{vandaag()}</p>
            </div>
          </header>

          {proeven.map((d, i) => {
            const details = [
              d.product_id ? artikelNaam.get(d.product_id) : null,
              d.product_kleur ? `kleur ${d.product_kleur}` : null,
              d.techniek === 'bedrukken' ? 'bedrukken' : 'borduren',
              d.ontwerp && d.kleur > 0 ? `${d.kleur} kleur${d.kleur === 1 ? '' : 'en'} in het logo` : null,
            ].filter(Boolean);
            return (
              <article key={d.id} className={`afdruk-blok ${i > 0 ? 'mt-8 border-t border-line pt-6' : 'mt-6'}`}>
                <h2 className="font-display text-lg font-bold text-ink-900">{d.naam}</h2>
                {details.length > 0 && <p className="text-sm text-warm">{details.join(' · ')}</p>}
                <div className={`mt-4 ${d.ontwerp ? '' : 'mx-auto max-w-[320px]'}`}>
                  <DrukproefPreview
                    afbeeldingUrl={d.afbeelding_url}
                    achterAfbeeldingUrl={d.achter_afbeelding_url ?? null}
                    ontwerp={d.ontwerp}
                    formaat="afdruk"
                    type={d.type}
                    kleur={d.kleur}
                    logoUrl={d.logo_url}
                    positie={d.positie}
                    techniek={d.techniek}
                  />
                </div>
                {d.omschrijving && <p className="mt-3 whitespace-pre-line text-sm text-ink-800">{d.omschrijving}</p>}
              </article>
            );
          })}

          <footer className="afdruk-blok mt-10 grid grid-cols-2 gap-8 border-t border-line pt-6 text-sm text-ink-800">
            <div>
              <p className="font-semibold">Akkoord klant</p>
              <p className="mt-8 border-b border-ink-300" />
              <p className="mt-1 text-xs text-warm">Naam en handtekening</p>
            </div>
            <div>
              <p className="font-semibold">Datum</p>
              <p className="mt-8 border-b border-ink-300" />
              <p className="mt-1 text-xs text-warm">{site.name} · {site.phone} · {site.email}</p>
            </div>
          </footer>
        </div>
      )}
    </main>
  );
}
