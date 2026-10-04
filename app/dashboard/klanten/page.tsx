import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLeadsDbConfigured } from '@/lib/env';
import { kmsAdmin, dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { mogelijkDubbeleKlanten } from '@/lib/kms/tellingen';
import { listKlantenGefilterd } from '@/lib/kms/klantenLijst';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import ActieKnopMobiel from '@/components/dashboard/ui/ActieKnopMobiel';
import FilterBalk from '@/components/dashboard/FilterBalk';
import { lijstParam, lijstUrl, param, periodeParam, sleutelsVan, type FilterDef } from '@/lib/filterBalk';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klanten', robots: { index: false, follow: false } };
const PER_PAGINA = 25;

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

/** 'ja'/'nee' of 'met'/'zonder' uit de URL; al het andere telt als "geen filter". */
function keuze<T extends string>(waarde: string, toegestaan: readonly T[]): T | null {
  return (toegestaan as readonly string[]).includes(waarde) ? (waarde as T) : null;
}

export default async function KlantenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  const sp = await searchParams;
  const huidigePagina = Math.max(1, Number(param(sp, 'pagina')) || 1);
  const zoekTerm = param(sp, 'zoek');
  const alleenDubbel = param(sp, 'dubbel') === '1';
  const sinds = periodeParam(sp, 'sinds');

  // Dubbelen worden altijd geteld (voor het filter), maar alleen gebruikt als je het aanzet.
  const [dubbelGroepen, aantalPerOrg, admin] = await Promise.all([mogelijkDubbeleKlanten(), medewerkersPerOrg(), getHuidigeAdmin()]);
  const dubbelIds = [...new Set(dubbelGroepen.flatMap((g) => g.ids))];

  const { rijen: orgs, totaal, opties } = await listKlantenGefilterd({
    pagina: huidigePagina,
    perPagina: PER_PAGINA,
    zoek: zoekTerm,
    branches: lijstParam(sp, 'branche'),
    plaats: param(sp, 'plaats') || null,
    actief: keuze(param(sp, 'actief'), ['ja', 'nee'] as const),
    portaal: keuze(param(sp, 'portaal'), ['ja', 'nee'] as const),
    openOrders: keuze(param(sp, 'open'), ['ja', 'nee'] as const),
    sindsVan: sinds.van,
    sindsTotExclusief: sinds.totExclusief,
    accountmanager: param(sp, 'am') || null,
    email: keuze(param(sp, 'email'), ['met', 'zonder'] as const),
    contact: keuze(param(sp, 'contact'), ['met', 'zonder'] as const),
    ids: alleenDubbel ? dubbelIds : null,
  });
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const alleKlanten = opties.totaal;

  const filterDefs: FilterDef[] = [
    { soort: 'multi', param: 'branche', label: 'Branche', weergave: 'chips', opties: opties.branches },
    { soort: 'select', param: 'plaats', label: 'Plaats', hoofd: true, leegLabel: 'Alle plaatsen', opties: opties.plaatsen },
    {
      soort: 'select',
      param: 'open',
      label: 'Orders',
      hoofd: true,
      leegLabel: 'Alle',
      opties: [
        { waarde: 'ja', label: 'Met open orders' },
        { waarde: 'nee', label: 'Zonder open orders' },
      ],
    },
    {
      soort: 'select',
      param: 'portaal',
      label: 'Portaal',
      opties: [
        { waarde: 'ja', label: 'Heeft portaalaccount' },
        { waarde: 'nee', label: 'Nog geen portaal' },
      ],
    },
    {
      soort: 'select',
      param: 'actief',
      label: 'Status',
      opties: [
        { waarde: 'ja', label: 'Actief' },
        { waarde: 'nee', label: 'Inactief' },
      ],
    },
    { soort: 'datum', param: 'sinds', label: 'Klant sinds' },
    { soort: 'select', param: 'am', label: 'Accountmanager', opties: opties.accountmanagers },
    {
      soort: 'select',
      param: 'email',
      label: 'E-mailadres',
      opties: [
        { waarde: 'met', label: 'Met e-mailadres' },
        { waarde: 'zonder', label: 'Zonder e-mailadres' },
      ],
    },
    {
      soort: 'select',
      param: 'contact',
      label: 'Contactpersoon',
      opties: [
        { waarde: 'met', label: 'Met contactpersoon' },
        { waarde: 'zonder', label: 'Zonder contactpersoon' },
      ],
    },
    ...(dubbelGroepen.length > 0
      ? [{ soort: 'aanuit' as const, param: 'dubbel', label: `Mogelijk dubbel (${dubbelGroepen.length})`, chipLabel: 'Mogelijk dubbel' }]
      : []),
  ];

  const heeftFilter = Boolean(zoekTerm) || filterDefs.some((d) => sleutelsVan(d).some((k) => param(sp, k)));
  const url = (wijzig: Record<string, string | number | null>) => lijstUrl('/dashboard/klanten', sp, wijzig);

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
        <Link href="/dashboard/klanten/nieuw" className="knop-primair max-md:hidden">Nieuwe klant</Link>
      </div>

      <FilterBalk filters={filterDefs} opslag="klanten" gebruiker={admin?.email} wisOok={['zoek']}>
        <LiveZoekveld
          param="zoek"
          placeholder="Zoek op naam, plaats, klantnummer of contactpersoon"
          ariaLabel="Zoeken in klanten"
          breedte="w-80 max-w-full"
        />
      </FilterBalk>

      {orgs.length === 0 ? (
        heeftFilter ? (
          <EmptyState
            className="mt-4"
            soort="gefilterd"
            titel="Geen klanten gevonden"
            tekst="Geen klant past bij deze zoekterm of filters. Haal een filter weg via het kruisje, of zoek op een deel van de naam."
            actieHref="/dashboard/klanten"
            actieLabel="Alle klanten tonen"
          />
        ) : (
          <EmptyState
            className="mt-4"
            titel="Nog geen klanten"
            tekst="Zet je eerste klant erin: bedrijf, contactpersoon en eventueel afdelingen en werknemers. Daarna maak je offertes en orders voor ze."
            actieHref="/dashboard/klanten/nieuw"
            actieLabel="Maak je eerste klant"
            tweedeHref="/dashboard/import"
            tweedeLabel="Klanten inlezen uit Excel"
          />
        )
      ) : (
      <div className="panel mt-4">
          <table className="tbl tbl-kaart">
            <thead className="thead-sticky-filter">
              <tr>
                <th className="w-20">Klantnr.</th>
                <th>Naam</th>
                <th>Branche</th>
                <th>Plaats</th>
                <th>Contactpersoon</th>
                <th className="num">Medew.</th>
                <th className="num">Open orders</th>
                <th>Klant sinds</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="stil tabular-nums" data-label="Klantnr.">{o.klantnummer || '—'}</td>
                  <td className="kaart-kop">
                    <Link href={`/dashboard/klanten/${o.id}`} className="rij-link">{o.naam}</Link>
                    {o.actief === false && <span className="badge-rust ml-1.5">inactief</span>}
                    {o.heeft_portaal && <span className="ml-1.5 text-[11px] text-warm" title="Heeft een account in het klantportaal">portaal</span>}
                    {alleenDubbel && dubbelReden.get(o.id) && (
                      <span className="mt-0.5 block text-[11px] text-amber-800">{dubbelReden.get(o.id)}</span>
                    )}
                  </td>
                  <td className="stil kaart-verberg" data-label="Branche">{o.branche || '—'}</td>
                  <td className="stil" data-label="Plaats">{o.plaats || '—'}</td>
                  <td className="stil" data-label="Contactpersoon">{o.contactpersoon || '—'}</td>
                  <td className="num stil kaart-verberg" data-label="Medewerkers">{aantalPerOrg[o.id] ?? 0}</td>
                  <td className="num" data-label="Open orders">
                    {o.open_orders > 0 ? (
                      <Link href={`/dashboard/orders?klant=${o.id}&fase=open`} className="font-semibold text-ink-900 hover:text-amber-700 hover:underline">
                        {o.open_orders}
                      </Link>
                    ) : (
                      <span className="text-warm">0</span>
                    )}
                  </td>
                  <td className="stil whitespace-nowrap kaart-verberg" data-label="Klant sinds">{fmt(o.datum_klant || o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

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

      <ActieKnopMobiel href="/dashboard/klanten/nieuw" label="Nieuwe klant" />
    </main>
  );
}
