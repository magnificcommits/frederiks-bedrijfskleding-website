import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import {
  listProductenGefilterd,
  listMerken,
  listLeveranciers,
  listCategorieen,
  listKlantenMetAssortiment,
  type ProductFilters,
} from '@/lib/kms/producten';
import { laadVariantLijsten } from '@/lib/kms/varianten';
import { KLEURGROEPEN, alleMaten } from '@/lib/kms/variantenStandaard';
import { fotosVan } from '@/lib/kms/catalogus';
import SortableTh from '@/components/dashboard/SortableTh';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import { telProductenZonderFoto } from '@/lib/kms/tellingen';
import { nieuwProduct } from './actions';
import { FilterKeuze, FilterVinkje, PrijsBereik } from './FilterBalk';
import { PROBLEEM_LABEL, type FotoProbleem } from './fotocontrole/meten';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Producten', robots: { index: false, follow: false } };

const inputCls = 'veld';
const PER_PAGINA = 25;
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

type Zoekparams = {
  zoek?: string;
  merk?: string;
  categorie?: string;
  leverancier?: string;
  status?: string;
  foto?: string;
  zonderfoto?: string;
  prijs_min?: string;
  prijs_max?: string;
  kleur?: string;
  maat?: string;
  voorraad?: string;
  klant?: string;
  pagina?: string;
  sort?: string;
  dir?: string;
};

const FILTER_PARAMS = ['zoek', 'merk', 'categorie', 'leverancier', 'status', 'foto', 'zonderfoto', 'prijs_min', 'prijs_max', 'kleur', 'maat', 'voorraad', 'klant'] as const;

function getal(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function ProductenPage({ searchParams }: { searchParams: Promise<Zoekparams> }) {
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

  const sp = await searchParams;
  const huidigePagina = Math.max(1, Number(sp.pagina) || 1);
  const dirParam = sp.dir === 'asc' ? 'asc' : sp.dir === 'desc' ? 'desc' : undefined;
  const foto = sp.foto === 'met' || sp.foto === 'zonder' || sp.foto === 'afwijkend' ? sp.foto : sp.zonderfoto === '1' ? 'zonder' : undefined;
  const filters: ProductFilters = {
    zoek: sp.zoek,
    merk: sp.merk?.trim() || undefined,
    categorie: sp.categorie?.trim() || undefined,
    leverancier: sp.leverancier?.trim() || undefined,
    status: sp.status === 'actief' || sp.status === 'inactief' ? sp.status : undefined,
    foto,
    prijsMin: getal(sp.prijs_min),
    prijsMax: getal(sp.prijs_max),
    kleur: sp.kleur?.trim() || undefined,
    maat: sp.maat?.trim() || undefined,
    opVoorraad: sp.voorraad === '1',
    klant: sp.klant?.trim() || undefined,
  };

  const [{ rijen: producten, totaal, bron }, merken, leveranciers, categorieen, klanten, lijst, zonderFotoTotaal, afwijkendR] = await Promise.all([
    listProductenGefilterd({ pagina: huidigePagina, perPagina: PER_PAGINA, filters, sort: sp.sort, dir: dirParam }),
    listMerken(),
    listLeveranciers(),
    listCategorieen(),
    listKlantenMetAssortiment(),
    laadVariantLijsten(),
    telProductenZonderFoto(),
    sb.from('producten_overzicht').select('id', { count: 'exact', head: true }).neq('foto_problemen', '{}'),
  ]);
  const afwijkendTotaal = afwijkendR.error ? null : (afwijkendR.count ?? 0);
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));

  // Querystring met alle huidige parameters, met wijzigingen. Voor paginering en het wegklikken van chips.
  const url = (wijzig: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const k of [...FILTER_PARAMS, 'sort', 'dir'] as const) {
      const v = sp[k];
      if (v) p.set(k, v);
    }
    if (foto && !sp.foto) {
      p.delete('zonderfoto');
      p.set('foto', foto);
    }
    for (const [k, v] of Object.entries(wijzig)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    return qs ? `/dashboard/producten?${qs}` : '/dashboard/producten';
  };

  const groepNaam = new Map<string, string>(KLEURGROEPEN.map((g) => [g.id, g.naam]));
  const groepVolgorde = new Map<string, number>(KLEURGROEPEN.map((g, i) => [g.id, i]));
  const kleurOpties = lijst.kleuren
    .filter((k) => k.actief !== false)
    .sort((a, b) => (groepVolgorde.get(a.groep) ?? 99) - (groepVolgorde.get(b.groep) ?? 99) || a.volgorde - b.volgorde)
    .map((k) => ({ value: k.naam, label: k.naam, groep: groepNaam.get(k.groep) ?? k.groep }));
  const gezienMaat = new Set<string>();
  const maatOpties = alleMaten(lijst)
    .filter((m) => (gezienMaat.has(m.maat) ? false : (gezienMaat.add(m.maat), true)))
    .map((m) => ({ value: m.maat, label: m.maat, groep: m.reeks }));
  const leverancierNaam = new Map(leveranciers.map((l) => [l.id, l.naam]));
  const klantNaam = new Map(klanten.map((k) => [k.id, k.naam]));

  const chips: { label: string; weg: Record<string, string | null> }[] = [];
  if (filters.zoek?.trim()) chips.push({ label: `Zoekt: ${filters.zoek.trim()}`, weg: { zoek: null } });
  if (filters.merk) chips.push({ label: `Merk: ${filters.merk}`, weg: { merk: null } });
  if (filters.categorie) chips.push({ label: `Categorie: ${filters.categorie}`, weg: { categorie: null } });
  if (filters.leverancier) chips.push({ label: `Leverancier: ${leverancierNaam.get(filters.leverancier) ?? 'onbekend'}`, weg: { leverancier: null } });
  if (filters.status) chips.push({ label: filters.status === 'actief' ? 'Alleen actief' : 'Alleen inactief', weg: { status: null } });
  if (foto) chips.push({ label: foto === 'met' ? 'Met foto' : foto === 'zonder' ? 'Zonder foto' : 'Foto wijkt af', weg: { foto: null, zonderfoto: null } });
  if (filters.prijsMin != null || filters.prijsMax != null) {
    const tekst = filters.prijsMin != null && filters.prijsMax != null ? `${euro(filters.prijsMin)} tot ${euro(filters.prijsMax)}` : filters.prijsMin != null ? `vanaf ${euro(filters.prijsMin)}` : `tot ${euro(filters.prijsMax!)}`;
    chips.push({ label: `Prijs: ${tekst}`, weg: { prijs_min: null, prijs_max: null } });
  }
  if (filters.kleur) chips.push({ label: `Kleur: ${filters.kleur}`, weg: { kleur: null } });
  if (filters.maat) chips.push({ label: `Maat: ${filters.maat}`, weg: { maat: null } });
  if (filters.opVoorraad) chips.push({ label: 'Op voorraad', weg: { voorraad: null } });
  if (filters.klant) chips.push({ label: `Assortiment: ${klantNaam.get(filters.klant) ?? 'klant'}`, weg: { klant: null } });

  const meerOpen = !!(filters.kleur || filters.maat || filters.prijsMin != null || filters.prijsMax != null || filters.opVoorraad || filters.klant || filters.leverancier);
  const exportQs = new URLSearchParams({ ...(foto === 'zonder' ? { zonderfoto: '1' } : {}), ...(filters.merk ? { merk: filters.merk } : {}) });

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Producten</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/producten/fotos-koppelen" className="knop-stil">Foto&apos;s koppelen</Link>
          <Link href="/dashboard/producten/fotocontrole" className="knop-stil">Fotocontrole</Link>
          <Drawer
            knop="Nieuw product"
            titel="Nieuw product"
            beschrijving="Vul de basisgegevens in. Na opslaan ga je door naar de productpagina voor varianten, prijzen en afbeeldingen."
          >
            <form action={nieuwProduct} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="veld-label">Naam</label>
                  <input name="naam" required placeholder="Bijv. Softshell jas" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Merk</label>
                  <input name="merk" placeholder="Merk" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Categorie</label>
                  <input name="categorie" placeholder="Bijv. Jassen" list="categorie-lijst" className={inputCls} />
                  <datalist id="categorie-lijst">
                    {categorieen.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="veld-label">Leverancier</label>
                  <select name="leverancier_id" className={inputCls}>
                    <option value="">Geen leverancier</option>
                    {leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="veld-label">Btw (%)</label>
                  <input name="btw" inputMode="decimal" defaultValue="21" className={inputCls} />
                </div>
                <button type="submit" className="self-start knop-donker">Product aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">
        De productcatalogus met varianten en prijzen. Zoeken kijkt ook naar de kleuren van de varianten: &lsquo;polo zwart&rsquo; vindt
        een polo die alleen in een zwarte variant bestaat.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <LiveZoekveld param="zoek" label="Zoeken" placeholder="Naam, SKU, merk, categorie, kleur" breedte="w-72" />
        <FilterKeuze param="merk" label="Merk" waarde={filters.merk ?? ''} leeg="Alle merken" opties={merken.map((m) => ({ value: m, label: m }))} />
        <FilterKeuze param="categorie" label="Categorie" waarde={filters.categorie ?? ''} leeg="Alle categorieën" opties={categorieen.map((c) => ({ value: c, label: c }))} />
        <FilterKeuze
          param="status"
          label="Status"
          breedte="w-32"
          waarde={filters.status ?? ''}
          leeg="Alle"
          opties={[
            { value: 'actief', label: 'Actief' },
            { value: 'inactief', label: 'Inactief' },
          ]}
        />
        <FilterKeuze
          param="foto"
          label="Foto"
          breedte="w-40"
          waarde={foto ?? ''}
          leeg="Alle"
          opties={[
            { value: 'met', label: 'Met foto' },
            { value: 'zonder', label: 'Zonder foto' },
            ...(afwijkendTotaal != null ? [{ value: 'afwijkend', label: 'Foto wijkt af' }] : []),
          ]}
        />
      </div>

      <details className="group mt-3" open={meerOpen}>
        <summary className="cursor-pointer select-none text-[13px] font-semibold text-warm hover:text-ink-900">
          Meer filters: kleur, maat, prijs, voorraad, leverancier, klant
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <FilterKeuze param="kleur" label="Kleur (variant)" waarde={filters.kleur ?? ''} leeg="Alle kleuren" opties={kleurOpties} />
          <FilterKeuze param="maat" label="Maat (variant)" breedte="w-36" waarde={filters.maat ?? ''} leeg="Alle maten" opties={maatOpties} />
          <PrijsBereik min={sp.prijs_min ?? ''} max={sp.prijs_max ?? ''} />
          <FilterKeuze param="leverancier" label="Leverancier" waarde={filters.leverancier ?? ''} leeg="Alle leveranciers" opties={leveranciers.map((l) => ({ value: l.id, label: l.naam }))} />
          <FilterKeuze param="klant" label="In assortiment bij" breedte="w-52" waarde={filters.klant ?? ''} leeg="Alle klanten" opties={klanten.map((k) => ({ value: k.id, label: k.naam }))} />
          <FilterVinkje param="voorraad" label="Alleen op voorraad" aan={!!filters.opVoorraad} />
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <Link key={c.label} href={url({ ...c.weg, pagina: null })} className="chip chip-aan" title="Filter weghalen">
            {c.label}
            <span aria-hidden="true">×</span>
            <span className="sr-only">weghalen</span>
          </Link>
        ))}
        {chips.length > 0 && <Link href="/dashboard/producten" className="knop-tekst">Alles wissen</Link>}
        {chips.length === 0 && (
          <>
            <Link href={url({ foto: 'zonder', zonderfoto: null, pagina: null })} className="chip">
              Zonder foto
              <span className="chip-tel">{zonderFotoTotaal}</span>
            </Link>
            {afwijkendTotaal != null && (
              <Link href={url({ foto: 'afwijkend', pagina: null })} className="chip">
                Foto wijkt af
                <span className="chip-tel">{afwijkendTotaal}</span>
              </Link>
            )}
          </>
        )}
        <span className="ml-auto flex items-center gap-3 text-[13px] text-warm">
          <span className="tabular-nums">{totaal.toLocaleString('nl-NL')} {totaal === 1 ? 'product' : 'producten'}</span>
          <a href={`/dashboard/producten/export?${exportQs}`} className="knop-stil" title="Download als CSV, met een lege kolom voor foto-URL's (merk en zonder-foto gaan mee)">
            Exporteer
          </a>
        </span>
      </div>
      {bron === 'terugval' && (
        <p className="mt-2 text-[12px] text-warm">
          Filters draaien nu zonder de database-view; na de migratie <code>20261004_varianten_en_fotocontrole</code> gaat het sneller
          en werkt ook &lsquo;foto wijkt af&rsquo;.
        </p>
      )}

      {producten.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            tekst={chips.length ? 'Geen producten bij deze filters.' : 'Geen producten gevonden. Voeg er rechtsboven een toe.'}
            actieHref={chips.length ? '/dashboard/producten' : undefined}
            actieLabel={chips.length ? 'Filters wissen' : undefined}
          />
        </div>
      ) : (
        <div className="panel mt-3">
          <table className="tbl">
            <thead className="thead-sticky">
              <tr>
                <th className="w-12"><span className="sr-only">Foto</span></th>
                <SortableTh label="Naam" col="naam" />
                <SortableTh label="Merk" col="merk" />
                <SortableTh label="Categorie" col="categorie" className="hidden lg:table-cell" />
                <SortableTh label="Varianten" col="aantal_varianten" className="hidden text-right sm:table-cell" />
                <SortableTh label="Vanaf" col="prijs_vanaf" className="hidden text-right md:table-cell" />
                <SortableTh label="Voorraad" col="voorraad_totaal" className="hidden text-right md:table-cell" />
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {producten.map((p) => {
                const foto0 = fotosVan(p.afbeeldingen)[0];
                const problemen = (p.foto_problemen ?? []) as FotoProbleem[];
                return (
                  <tr key={p.id}>
                    <td>
                      {foto0 ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={foto0} alt="" loading="lazy" className="h-9 w-9 rounded border border-line bg-white object-contain" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-line text-[10px] text-warm" title="Geen foto">geen</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/dashboard/producten/${p.id}`} className="rij-link">{p.naam}</Link>
                      {problemen.length > 0 && (
                        <Link href={`/dashboard/producten/${p.id}?tab=kleuren`} className="ml-2 inline-flex gap-1 align-middle" title="Uit de fotocontrole">
                          {problemen.slice(0, 2).map((x) => (
                            <span key={x} className="badge-actie">{PROBLEEM_LABEL[x] ?? x}</span>
                          ))}
                          {problemen.length > 2 && <span className="badge-actie">+{problemen.length - 2}</span>}
                        </Link>
                      )}
                    </td>
                    <td className="stil">{p.merk || '-'}</td>
                    <td className="stil hidden lg:table-cell">{p.categorie || '-'}</td>
                    <td className="num stil hidden sm:table-cell">{p.aantal_varianten}</td>
                    <td className="num hidden md:table-cell">{p.prijs_vanaf != null ? euro(Number(p.prijs_vanaf)) : '-'}</td>
                    <td className="num hidden md:table-cell">{p.voorraad_totaal != null ? p.voorraad_totaal : '-'}</td>
                    <td>
                      <span className={p.actief ? 'badge-klaar' : 'badge-rust'}>{p.actief ? 'actief' : 'inactief'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {aantalPaginas > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
          {huidigePagina > 1 ? (
            <Link href={url({ pagina: String(huidigePagina - 1) })} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
          ) : <span />}
          <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
          {huidigePagina < aantalPaginas ? (
            <Link href={url({ pagina: String(huidigePagina + 1) })} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
