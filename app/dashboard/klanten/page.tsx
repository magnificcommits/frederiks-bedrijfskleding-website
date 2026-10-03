import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLeadsDbConfigured } from '@/lib/env';
import { listOrganisatiesPaged, type Organisatie } from '@/lib/portaalAdmin';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { mogelijkDubbeleKlanten } from '@/lib/kms/tellingen';
import { zoekWoorden, ilikeInKolommen, KLANT_ZOEKKOLOMMEN, klantIdsViaContactpersonen } from '@/lib/kms/zoeken';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klanten', robots: { index: false, follow: false } };
const PER_PAGINA = 25;

/**
 * Eén pagina klanten met server-side filter op zoekterm en op branche. Elk
 * woord moet voorkomen in naam, plaats, klantnummer of contactpersoon, of in de
 * naam of het e-mailadres van een van de contactpersonen van de klant. Zonder filters valt de pagina terug op de
 * bestaande helper `listOrganisatiesPaged`, zodat het gedrag identiek blijft.
 * Filteren en pagineren gebeuren beide server-side in de query.
 */
async function zoekOrganisatiesPaged(opts: {
  pagina: number;
  perPagina: number;
  zoek?: string;
  branche?: string;
  ids?: string[];
}): Promise<{ rijen: Organisatie[]; totaal: number }> {
  const woorden = zoekWoorden(opts.zoek);
  const branche = (opts.branche ?? '').trim();
  if (!woorden.length && !branche && !opts.ids) return listOrganisatiesPaged({ pagina: opts.pagina, perPagina: opts.perPagina });
  const sb = kmsAdmin();
  if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  let q = sb.from('organisaties').select('*', { count: 'exact' });
  if (woorden.length) {
    // Per woord één or-filter; meerdere or-filters gelden samen (EN).
    const viaContact = await klantIdsViaContactpersonen(sb, woorden);
    woorden.forEach((w, i) => {
      const ids = viaContact[i] ?? [];
      const extra = ids.length ? `,id.in.(${ids.join(',')})` : '';
      q = q.or(ilikeInKolommen(KLANT_ZOEKKOLOMMEN, w) + extra);
    });
  }
  if (branche) q = q.eq('branche', branche);
  if (opts.ids) q = q.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000']);
  const { data, count } = await q.order('naam').range(from, to);
  return { rijen: (data as Organisatie[]) ?? [], totaal: count ?? 0 };
}

/**
 * Aantal klanten per branche, voor de tellers op de filterchips.
 * Eén query over één kolom; bij 183 klanten verwaarloosbaar. Boven ~20.000
 * rijen is een database-functie met GROUP BY zuiniger.
 */
async function klantenPerBranche(): Promise<{ branche: string; aantal: number }[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('organisaties').select('branche');
  const map = new Map<string, number>();
  ((data as { branche: string | null }[]) ?? []).forEach((r) => {
    const b = r.branche?.trim();
    if (b) map.set(b, (map.get(b) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([branche, aantal]) => ({ branche, aantal }))
    .sort((a, b) => b.aantal - a.aantal || a.branche.localeCompare(b.branche, 'nl'));
}

/** Aantal medewerkers per organisatie, in één query opgehaald en geteld. */
async function medewerkersPerOrg(): Promise<Record<string, number>> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const { data } = await sb.from('medewerkers').select('organisatie_id');
  const map: Record<string, number> = {};
  ((data as { organisatie_id: string | null }[]) ?? []).forEach((r) => {
    if (r.organisatie_id) map[r.organisatie_id] = (map[r.organisatie_id] ?? 0) + 1;
  });
  return map;
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default async function KlantenPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; zoek?: string; branche?: string; dubbel?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  if (!isLeadsDbConfigured) {
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

  const { pagina, zoek, branche, dubbel } = await searchParams;
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const zoekTerm = (zoek ?? '').trim();
  const brancheFilter = (branche ?? '').trim();
  const alleenDubbel = dubbel === '1';

  // Dubbelen worden altijd geteld (voor de chip), maar alleen als filter gebruikt
  // wanneer je erop klikt.
  const dubbelGroepen = await mogelijkDubbeleKlanten();
  const dubbelIds = [...new Set(dubbelGroepen.flatMap((g) => g.ids))];

  const [{ rijen: orgs, totaal }, aantalPerOrg, branches] = await Promise.all([
    zoekOrganisatiesPaged({
      pagina: huidigePagina,
      perPagina: PER_PAGINA,
      zoek: zoekTerm,
      branche: brancheFilter,
      ids: alleenDubbel ? dubbelIds : undefined,
    }),
    medewerkersPerOrg(),
    klantenPerBranche(),
  ]);
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const alleKlanten = branches.reduce((n, b) => n + b.aantal, 0);

  /** Bouwt een URL en laat de andere filters staan. Pagina gaat terug naar 1. */
  function url(next: { zoek?: string; branche?: string; pagina?: number }) {
    const p = new URLSearchParams();
    const z = next.zoek !== undefined ? next.zoek : zoekTerm;
    const b = next.branche !== undefined ? next.branche : brancheFilter;
    if (z) p.set('zoek', z);
    if (b) p.set('branche', b);
    if (next.pagina && next.pagina > 1) p.set('pagina', String(next.pagina));
    const qs = p.toString();
    return qs ? `/dashboard/klanten?${qs}` : '/dashboard/klanten';
  }

  const heeftFilter = Boolean(zoekTerm || brancheFilter || alleenDubbel);
  // Reden per klant, zodat de tabel kan tonen wáárom iets dubbel lijkt.
  const dubbelReden = new Map<string, string>();
  dubbelGroepen.forEach((g) => g.ids.forEach((i) => dubbelReden.set(i, g.reden)));

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="dash-h1">Klanten</h1>
          <span className="text-[13px] tabular-nums text-warm">
            {heeftFilter ? `${totaal} van ${alleKlanten}` : alleKlanten}
          </span>
        </div>
        {/* Nieuwe klant gaat stap voor stap: bedrijf, contactpersonen, afdelingen,
            werknemers en assortiment. Elke stap slaat meteen op. */}
        <Link href="/dashboard/klanten/nieuw" className="knop-primair">Nieuwe klant</Link>
      </div>

      <div className="dash-filter flex flex-wrap items-center gap-2">
        <LiveZoekveld
          param="zoek"
          placeholder="Zoek op naam, plaats, klantnummer of contactpersoon"
          ariaLabel="Zoeken in klanten"
          breedte="w-80 max-w-full"
        />

        {brancheFilter && (
          <Link href={url({ branche: '' })} className="chip chip-aan" title="Filter op branche wissen">
            {brancheFilter}
            <span aria-hidden="true">×</span>
            <span className="sr-only">wissen</span>
          </Link>
        )}
        {dubbelGroepen.length > 0 && (
          <Link
            href={alleenDubbel ? '/dashboard/klanten' : '/dashboard/klanten?dubbel=1'}
            className={`chip ${alleenDubbel ? 'chip-aan' : ''}`}
            title="Klanten met hetzelfde e-mailadres, telefoonnummer of adres"
          >
            Mogelijk dubbel
            <span className="chip-tel">{dubbelGroepen.length}</span>
          </Link>
        )}
        {heeftFilter && (
          <Link href="/dashboard/klanten" className="knop-tekst">Alles wissen</Link>
        )}
      </div>

      {!brancheFilter && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {branches.map((b) => (
            <Link key={b.branche} href={url({ branche: b.branche })} className="chip">
              {b.branche}
              <span className="chip-tel">{b.aantal}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="panel mt-4">
        {orgs.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-warm">
            Geen klanten gevonden{heeftFilter ? ' met deze filters' : ''}.
          </p>
        ) : (
          <table className="tbl">
            <thead className="thead-sticky-filter">
              <tr>
                <th className="w-20">Klantnr.</th>
                <th>Naam</th>
                <th>Branche</th>
                <th>Plaats</th>
                <th>Contactpersoon</th>
                <th className="num">Medew.</th>
                <th>Klant sinds</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="stil tabular-nums">{o.klantnummer || '—'}</td>
                  <td>
                    <Link href={`/dashboard/klanten/${o.id}`} className="rij-link">{o.naam}</Link>
                    {alleenDubbel && dubbelReden.get(o.id) && (
                      <span className="mt-0.5 block text-[11px] text-amber-800">{dubbelReden.get(o.id)}</span>
                    )}
                  </td>
                  <td className="stil">{o.branche || '—'}</td>
                  <td className="stil">{o.plaats || '—'}</td>
                  <td className="stil">{o.contactpersoon || '—'}</td>
                  <td className="num stil">{aantalPerOrg[o.id] ?? 0}</td>
                  <td className="stil whitespace-nowrap">{fmt(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {aantalPaginas > 1 && (
        <nav className="mt-3 flex items-center justify-between gap-4 text-[13px]" aria-label="Paginering">
          {huidigePagina > 1 ? (
            <Link href={url({ pagina: huidigePagina - 1 })} className="knop-stil">Vorige</Link>
          ) : <span />}
          <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
          {huidigePagina < aantalPaginas ? (
            <Link href={url({ pagina: huidigePagina + 1 })} className="knop-stil">Volgende</Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
