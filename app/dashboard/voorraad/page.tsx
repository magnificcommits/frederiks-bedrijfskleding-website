import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import {
  filterVoorraad,
  getVoorraadOverzicht,
  groepSleutel,
  sorteerVoorraad,
  GROEPERINGEN,
  type Groepering,
  type VoorraadFilter,
} from '@/lib/kms/voorraad';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import VoorraadLijst, { type TabelRij } from './VoorraadLijst';
import { UrlSegment, UrlSelect, UrlVinkje } from './UrlKeuze';
import { bijbestellenActie } from './actions';
import BevestigKnop from './BevestigKnop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Voorraad', robots: { index: false, follow: false } };

const PER_PAGINA = 100;

type Zoek = {
  q?: string; merk?: string; cat?: string; lev?: string; status?: string; voorraad?: string; bijhouden?: string;
  groep?: string; sort?: string; dir?: string; pagina?: string; melding?: string;
};

const euro0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const aantal = new Intl.NumberFormat('nl-NL');

const STATUS_CHIPS = ['ok', 'laag', 'op', 'onder_minimum', 'gereserveerd', 'niet_lopend', 'niet'] as const;
const CHIP_LABEL: Record<string, string> = {
  ok: 'op voorraad',
  laag: 'laag',
  op: 'op',
  onder_minimum: 'onder minimum',
  gereserveerd: 'gereserveerd',
  niet_lopend: 'niet-lopend',
  niet: 'niet op voorraad gehouden',
};

export default async function VoorraadPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sp = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const data = await getVoorraadOverzicht();
  const k = data.kpis;
  const groep: Groepering = (GROEPERINGEN as readonly string[]).includes(sp.groep ?? '') ? (sp.groep as Groepering) : 'geen';
  const filter: VoorraadFilter = {
    q: sp.q,
    merk: sp.merk,
    categorie: sp.cat,
    leverancier: sp.lev,
    status: sp.status,
    metVoorraad: sp.voorraad === '1',
    bijhouden: sp.bijhouden,
    groep,
    sort: sp.sort,
    dir: sp.dir === 'desc' ? 'desc' : 'asc',
  };

  // Aantallen per status over alles behalve het statusfilter zelf.
  const zonderStatus = filterVoorraad(data.rijen, { ...filter, status: undefined });
  const telling: Record<string, number> = {};
  for (const s of STATUS_CHIPS) telling[s] = 0;
  for (const r of zonderStatus) {
    telling[r.status] += 1;
    if (r.status === 'laag' || (r.status === 'op' && r.min_voorraad != null)) telling.onder_minimum += 1;
    if (r.gereserveerd > 0) telling.gereserveerd += 1;
    if (r.nietLopend) telling.niet_lopend += 1;
  }
  const chips = STATUS_CHIPS.filter((s) => telling[s] > 0 || sp.status === s).map((s) => ({ code: s, label: CHIP_LABEL[s], aantal: telling[s] }));

  const gefilterd = sorteerVoorraad(sp.status ? filterVoorraad(zonderStatus, { status: sp.status, bijhouden: 'alle' }) : zonderStatus, filter);
  const paginas = Math.max(1, Math.ceil(gefilterd.length / PER_PAGINA));
  const pagina = Math.min(paginas, Math.max(1, Number(sp.pagina) || 1));
  const tabel: TabelRij[] = gefilterd.slice((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA).map((r) => ({
    variant_id: r.variant_id,
    product_id: r.product_id,
    product_naam: r.product_naam,
    merk: r.merk,
    foto: r.foto,
    maat: r.maat,
    kleur: r.kleur,
    locatie: r.locatie,
    voorraad: r.voorraad,
    gereserveerd: r.gereserveerd,
    beschikbaar: r.beschikbaar,
    onderweg: r.onderweg,
    min_voorraad: r.min_voorraad,
    inkoopprijs: r.inkoopprijs,
    inkoopwaarde: r.inkoopwaarde,
    bijhouden: r.bijhouden,
    bijhoudenEigen: r.bijhoudenEigen,
    status: r.status,
    laatsteVerkoop: r.laatsteVerkoop,
    groep: groepSleutel(r, groep),
  }));

  const teBestellen = data.rijen.filter((r) => r.bijhouden && r.min_voorraad != null && r.beschikbaar + r.onderweg < r.min_voorraad).length;
  const bewaar: Record<string, string | undefined> = {
    q: sp.q, merk: sp.merk, cat: sp.cat, lev: sp.lev, voorraad: sp.voorraad, bijhouden: sp.bijhouden, groep: sp.groep, sort: sp.sort, dir: sp.dir,
  };

  const paginaUrl = (n: number) => {
    const p = new URLSearchParams();
    for (const [key, v] of Object.entries({ ...bewaar, status: sp.status })) if (v) p.set(key, v);
    if (n > 1) p.set('pagina', String(n));
    const qs = p.toString();
    return qs ? `/dashboard/voorraad?${qs}` : '/dashboard/voorraad';
  };

  const standaardLeeg = (sp.bijhouden ?? 'ja') === 'ja' && k.voorraadartikelen === 0;

  return (
    <main className="container-app pb-12">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="dash-h1">Voorraad</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/voorraad/telling" className="knop-stil">Telling starten</Link>
          <form action={bijbestellenActie}>
            <BevestigKnop
              vraag={`Voor ${teBestellen === 1 ? '1 artikel' : `${teBestellen} artikelen`} onder het minimum een inkoopregel klaarzetten?`}
              disabled={teBestellen === 0}
              className="knop-primair"
            >
              Bijbestellen{teBestellen > 0 ? ` (${teBestellen})` : ''}
            </BevestigKnop>
          </form>
        </div>
      </div>

      <p className="mt-3 max-w-3xl dash-sub">
        Alleen wat je echt op de plank hebt, staat hier standaard. De rest bestel je op order en heet hier
        &quot;niet op voorraad gehouden&quot;. Vink zulke artikelen aan via <em>Alle artikelen</em> als je ze toch op voorraad wilt houden.
      </p>

      {sp.melding === 'niets_bij' && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          Er zit niets onder het minimum dat nog niet besteld is. Er is niets klaargezet.
        </p>
      )}
      {!data.instellingenKlaar && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          De databasemigratie van 4 oktober is nog niet gedraaid. Voorraad aanpassen werkt, maar &quot;voorraadartikel ja/nee&quot;,
          minimum per maat, locatie en historie komen pas daarna. Tot dan telt alles met voorraad of een productminimum als voorraadartikel.
        </p>
      )}

      <section aria-label="Kerncijfers" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTegel
          label="Voorraadwaarde inkoop"
          waarde={euro0.format(k.waardeInkoop)}
          href="/dashboard/voorraad?voorraad=1&sort=waarde&dir=desc"
          sub={
            <span className="text-warm">
              Verkoopwaarde <span className="font-semibold text-ink-800">{euro0.format(k.waardeVerkoop)}</span>
              {k.waardeVerkoop > k.waardeInkoop && k.waardeInkoop > 0 && (
                <> · marge {euro0.format(k.waardeVerkoop - k.waardeInkoop)}</>
              )}
            </span>
          }
        />
        <KpiTegel
          label="Artikelen op voorraad"
          waarde={aantal.format(k.artikelenOpVoorraad)}
          href="/dashboard/voorraad?voorraad=1"
          sub={<span className="text-warm">{aantal.format(k.stuksOpVoorraad)} stuks · {aantal.format(k.voorraadartikelen)} voorraadartikelen</span>}
        />
        <KpiTegel
          label="Onder minimum"
          waarde={aantal.format(k.onderMinimum)}
          href="/dashboard/voorraad?status=onder_minimum"
          sub={
            k.onderMinimum > 0 ? (
              <span className="font-semibold text-amber-800">{k.op} helemaal op · bijbestellen staat rechtsboven</span>
            ) : (
              <span className="text-warm">Niets onder het minimum</span>
            )
          }
        />
        <KpiTegel
          label="Niet-lopend (6 maanden)"
          waarde={aantal.format(k.nietLopend)}
          href="/dashboard/voorraad?status=niet_lopend&sort=waarde&dir=desc"
          sub={<span className="text-warm">{euro0.format(k.nietLopendWaarde)} ligt stil op de plank</span>}
        />
        <KpiTegel
          label="Gereserveerd voor orders"
          waarde={`${aantal.format(k.gereserveerdStuks)} st.`}
          href="/dashboard/voorraad?status=gereserveerd"
          sub={<span className="text-warm">uit {k.openOrders} {k.openOrders === 1 ? 'open order' : 'open orders'}</span>}
        />
      </section>

      <section aria-label="Filters" className="mt-5 flex flex-wrap items-end gap-3">
        <LiveZoekveld placeholder="Zoek product, kleur, maat of locatie" label="Zoeken" breedte="w-full sm:w-72" vergeet={['melding']} />
        <UrlSelect param="merk" label="Merk" leegLabel="Alle merken" opties={data.merken.map((m) => ({ value: m, label: m }))} />
        <UrlSelect param="cat" label="Categorie" leegLabel="Alle categorieën" opties={data.categorieen.map((c) => ({ value: c, label: c }))} />
        <UrlSelect param="lev" label="Leverancier" leegLabel="Alle leveranciers" opties={data.leveranciers.map((l) => ({ value: l.id, label: l.naam }))} />
        <UrlSegment
          param="bijhouden"
          label="Welke artikelen"
          standaard="ja"
          opties={[
            { value: 'ja', label: 'Voorraadartikelen' },
            { value: 'alle', label: 'Alle artikelen' },
            { value: 'nee', label: 'Op order' },
          ]}
        />
        <UrlSegment
          param="groep"
          label="Groeperen op"
          standaard="geen"
          opties={[
            { value: 'geen', label: 'Geen' },
            { value: 'merk', label: 'Merk' },
            { value: 'categorie', label: 'Categorie' },
            { value: 'leverancier', label: 'Leverancier' },
          ]}
        />
        <UrlVinkje param="voorraad" label="Alleen met voorraad" />
      </section>

      {chips.length > 0 && (
        <div className="mt-3">
          <VoorraadChips huidig={sp.status ?? ''} chips={chips} totaal={zonderStatus.length} bewaar={bewaar} />
        </div>
      )}

      <p className="mt-4 text-[12px] text-warm">
        {gefilterd.length === 0
          ? 'Geen regels.'
          : `${aantal.format(gefilterd.length)} ${gefilterd.length === 1 ? 'regel' : 'regels'} (maat en kleur)${
              paginas > 1 ? `, pagina ${pagina} van ${paginas}` : ''
            }`}
      </p>

      {gefilterd.length === 0 ? (
        <div className="mt-3">
          {standaardLeeg ? (
            <EmptyState
              titel="Nog geen voorraadartikelen"
              tekst="Alles staat nu op 'besteld op order', daarom is deze lijst leeg in plaats van 25.000 nullen. Open 'Alle artikelen', zoek wat je op de plank hebt liggen, vink het aan en kies Voorraadartikel maken."
              actieHref="/dashboard/voorraad?bijhouden=alle"
              actieLabel="Alle artikelen tonen"
            />
          ) : (
            <EmptyState tekst="Niets gevonden met deze filters." actieHref="/dashboard/voorraad" actieLabel="Filters wissen" />
          )}
        </div>
      ) : (
        <VoorraadLijst rijen={tabel} gegroepeerd={groep !== 'geen'} instellingenKlaar={data.instellingenKlaar} mutatiesKlaar={data.mutatiesKlaar} />
      )}

      {paginas > 1 && (
        <nav aria-label="Paginering" className="mt-4 flex flex-wrap items-center gap-2">
          {pagina > 1 && <Link href={paginaUrl(pagina - 1)} className="knop-stil">Vorige</Link>}
          <span className="text-[13px] text-warm">Pagina {pagina} van {paginas}</span>
          {pagina < paginas && <Link href={paginaUrl(pagina + 1)} className="knop-stil">Volgende</Link>}
        </nav>
      )}
    </main>
  );
}

/**
 * Statusfilter als chips met aantallen, zelfde vormgeving als StatusChips,
 * maar met een leesbaar label en een korte code in de URL.
 */
function VoorraadChips({
  huidig,
  chips,
  totaal,
  bewaar,
}: {
  huidig: string;
  chips: { code: string; label: string; aantal: number }[];
  totaal: number;
  bewaar: Record<string, string | undefined>;
}) {
  const url = (code: string) => {
    const p = new URLSearchParams();
    for (const [key, v] of Object.entries(bewaar)) if (v) p.set(key, v);
    if (code) p.set('status', code);
    const qs = p.toString();
    return qs ? `/dashboard/voorraad?${qs}` : '/dashboard/voorraad';
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={url('')} className={`chip ${huidig ? '' : 'chip-aan'}`}>
        Alle
        <span className="chip-tel">{totaal}</span>
      </Link>
      {chips.map((c) => (
        <Link key={c.code} href={url(c.code)} className={`chip ${huidig === c.code ? 'chip-aan' : ''}`}>
          {c.label}
          <span className="chip-tel">{c.aantal}</span>
        </Link>
      ))}
    </div>
  );
}
