import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import {
  inkoopKpis,
  listInkooporders,
  losseOpenRegels,
  teBestellenPerInkooppartij,
  portaalLink,
  INKOOPORDER_BADGE,
  INKOOPORDER_LABEL,
  type BestelPartijGroep,
  type BestelMerkGroep,
  type InkoopregelMetLeverancier,
  type InkooporderOverzicht,
} from '@/lib/kms/inkoop';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import { UrlSegment, UrlSelect } from '../voorraad/UrlKeuze';
import AllesAanvinken from './AllesAanvinken';
import BestelmailKnop from './BestelmailKnop';
import { maakInkooporderActie, markeerInkoop, markeerRegelsBesteldActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inkoop', robots: { index: false, follow: false } };

function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const euroFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const euro = (bedrag: number) => euroFormatter.format(bedrag);

const meervoud = (n: number, enkel: string, meer: string) => `${n} ${n === 1 ? enkel : meer}`;

const inkoopBadge: Record<string, string> = {
  te_bestellen: 'bg-amber-100 text-amber-800',
  besteld: 'bg-ink-100 text-ink-700',
  // Deels geleverd is geen rustpunt: daar moet nog een restant binnenkomen.
  deels: 'bg-amber-100 text-amber-800',
  geleverd: 'bg-green-100 text-green-800',
};

/** 'deels' zegt op zichzelf niets; in de tabel staat wat het betekent. */
const inkoopLabel: Record<string, string> = {
  te_bestellen: 'te bestellen',
  besteld: 'besteld',
  deels: 'deels geleverd',
  geleverd: 'geleverd',
};

/** Telefoonnummers staan met spaties in de tabel; een tel:-link wil ze zonder. */
const telLink = (nummer: string) => `tel:${nummer.replace(/[^\d+]/g, '')}`;

/**
 * Meldingen waar Jessi nog iets mee moet, krijgen het rode vak. Groen betekent
 * hier: het is gelukt. Een groene balk met "er is niets gewijzigd" leest als
 * een bevestiging terwijl er juist niets gebeurd is.
 */
type Melding = { tekst: string; waarschuwing: boolean };

function melding(ok?: string, aantal?: string, gemaild?: string): Melding | null {
  if (!ok) return null;
  const n = Number(aantal) || 0;
  if (ok === 'afgevinkt') {
    return n === 0
      ? { tekst: 'Die regels stonden al niet meer op te bestellen, er is niets gewijzigd.', waarschuwing: true }
      : { tekst: `${meervoud(n, 'regel', 'regels')} afgevinkt als besteld.`, waarschuwing: false };
  }
  if (ok === 'geen_selectie') {
    return { tekst: 'Er was niets aangevinkt, dus er is niets gewijzigd.', waarschuwing: true };
  }
  if (ok === 'besteld') {
    if (n === 0) {
      return {
        tekst: 'Bij dit merk stond niets meer open, dus er is geen mail verstuurd en er is niets gewijzigd.',
        waarschuwing: true,
      };
    }
    return gemaild === '1'
      ? { tekst: `${meervoud(n, 'regel', 'regels')} op besteld gezet en de bestelmail is verstuurd.`, waarschuwing: false }
      : {
          tekst: `${meervoud(n, 'regel', 'regels')} op besteld gezet, maar de mail is niet verstuurd. Controleer het e-mailadres bij dit merk en stuur de bestelling zelf door.`,
          waarschuwing: true,
        };
  }
  if (ok === 'geleverd') return { tekst: 'De levering is vastgelegd, deze regel is compleet.', waarschuwing: false };
  if (ok === 'deels') {
    return {
      tekst: 'De levering is vastgelegd. Er staat nog een restant open, dus de regel blijft op deels staan.',
      waarschuwing: false,
    };
  }
  if (ok === 'terug') return { tekst: 'De regel staat weer bij te bestellen.', waarschuwing: false };
  if (ok === 'bijgewerkt') return { tekst: 'De regel is bijgewerkt.', waarschuwing: false };
  if (ok === 'mislukt') return { tekst: 'Dat is niet gelukt. Probeer het nog een keer.', waarschuwing: true };
  if (ok === 'bijbesteld') return { tekst: `${meervoud(n, 'regel', 'regels')} voor bijbestellen klaargezet. Ze staan hieronder bij hun inkooppartij.`, waarschuwing: false };
  if (ok === 'po_concept') return { tekst: `${meervoud(n, 'concept-inkooporder', 'concept-inkooporders')} gemaakt, één per inkooppartij.`, waarschuwing: false };
  if (ok === 'po_weg') return { tekst: `Concept weggegooid. ${meervoud(n, 'regel staat', 'regels staan')} weer bij te bestellen.`, waarschuwing: false };
  if (ok === 'migratie') {
    return { tekst: 'Inkooporders kunnen pas als de databasemigratie van 4 oktober gedraaid is. Afvinken als besteld werkt wel.', waarschuwing: true };
  }
  return null;
}

/* ---------------------------------------------------------------- bestellijst */

/**
 * De knop naar de B2B-webshop, of de bestelwijze als er geen portaal is.
 * FHB bestelt via mail; daar hoort tekst te staan, geen knop die nergens heen gaat.
 */
function BestelIngang({ partij }: { partij: BestelPartijGroep }) {
  const link = portaalLink(partij.bestelportaal_url);
  if (link) {
    return (
      <div className="text-right">
        <a href={link} target="_blank" rel="noopener noreferrer" className="knop-primair">
          B2B-webshop openen
        </a>
        {partij.bestelwijze && <p className="mt-1 text-[12px] text-warm">{partij.bestelwijze}</p>}
      </div>
    );
  }
  if (partij.bestelwijze) {
    return (
      <div className="max-w-xs rounded-md border border-line bg-white px-3 py-2 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Bestelwijze</p>
        <p className="mt-0.5 text-[13px] font-medium text-ink-900">{partij.bestelwijze}</p>
      </div>
    );
  }
  return (
    <p className="max-w-xs text-right text-[12px] text-warm">
      Geen bestelportaal en geen bestelwijze bekend. Vul die in bij de leverancier, dan staat de knop hier de
      volgende keer.
    </p>
  );
}

/** Contactgegevens van de handelspartij, zodat ze niet in de mail gezocht hoeven te worden. */
function Contactregel({ partij }: { partij: BestelPartijGroep }) {
  const heeftIets =
    partij.contactpersoon || partij.email || partij.telefoon || partij.telefoon_hoofdkantoor;
  if (!heeftIets) {
    return (
      <p className="border-b border-line px-4 py-2 text-[12px] text-warm">
        Geen contactgegevens bekend bij deze inkooppartij.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-2 text-[13px] text-warm">
      {partij.contactpersoon && (
        <span>
          Contact: <span className="font-semibold text-ink-900">{partij.contactpersoon}</span>
        </span>
      )}
      {partij.email && (
        <a href={`mailto:${partij.email}`} className="font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
          {partij.email}
        </a>
      )}
      {partij.telefoon && (
        <a href={telLink(partij.telefoon)} className="font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
          {partij.telefoon}
        </a>
      )}
      {partij.telefoon_hoofdkantoor && partij.telefoon_hoofdkantoor !== partij.telefoon && (
        <span>
          Hoofdkantoor:{' '}
          <a href={telLink(partij.telefoon_hoofdkantoor)} className="font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
            {partij.telefoon_hoofdkantoor}
          </a>
        </span>
      )}
    </div>
  );
}

function MerkBlok({ merk, partij, toonMailKnop }: { merk: BestelMerkGroep; partij: BestelPartijGroep; toonMailKnop: boolean }) {
  // Alleen tonen wat afwijkt van de partij: anders herhaalt bij Houweling
  // hetzelfde mailadres zich tien keer onder elkaar.
  const afwijkendeWijze = merk.bestelwijze && merk.bestelwijze !== partij.bestelwijze ? merk.bestelwijze : null;
  const afwijkendContact = merk.email && merk.email !== partij.email ? merk.email : null;

  return (
    <div className="border-t border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="min-w-0">
          <h4 className="font-display text-[13px] font-bold uppercase tracking-wide text-ink-900">{merk.merk}</h4>
          <p className="text-[12px] text-warm">
            {meervoud(merk.regels.length, 'regel', 'regels')} · {meervoud(merk.aantalStuks, 'stuk', 'stuks')} ·{' '}
            {euro(merk.inkoopwaarde)}
            {merk.regelsZonderPrijs > 0 &&
              ` · ${meervoud(merk.regelsZonderPrijs, 'regel', 'regels')} zonder inkoopprijs`}
          </p>
          {afwijkendeWijze && <p className="text-[12px] text-warm">Bestelwijze: {afwijkendeWijze}</p>}
          {afwijkendContact && (
            <p className="text-[12px] text-warm">
              Mail:{' '}
              <a href={`mailto:${afwijkendContact}`} className="font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
                {afwijkendContact}
              </a>
            </p>
          )}
        </div>
        {toonMailKnop && merk.leverancier_id && merk.email && (
          <BestelmailKnop
            leverancierId={merk.leverancier_id}
            merk={merk.merk}
            email={merk.email}
            aantalRegels={merk.regels.length}
          />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col" className="w-8">
                <span className="sr-only">Besteld</span>
              </th>
              <th scope="col">Artikel</th>
              <th scope="col">Maat</th>
              <th scope="col">Kleur</th>
              <th scope="col" className="text-right">Aantal</th>
              <th scope="col" className="text-right">Inkoop p/st</th>
              <th scope="col" className="text-right">Regelwaarde</th>
              <th scope="col">Voor wie</th>
            </tr>
          </thead>
          <tbody>
            {merk.regels.map((r) => (
              <tr key={r.id}>
                <td>
                  <label className="sr-only" htmlFor={`regel-${r.id}`}>
                    {[r.item_naam ?? 'Artikel', r.maat, r.kleur].filter(Boolean).join(' ')} afvinken als besteld
                  </label>
                  <input
                    id={`regel-${r.id}`}
                    type="checkbox"
                    name="regelId"
                    value={r.id}
                    className="h-4 w-4 accent-ink-900"
                  />
                </td>
                <td className="font-semibold text-ink-900">{r.item_naam ?? '-'}</td>
                <td className="stil">{r.maat ?? '-'}</td>
                <td className="stil">{r.kleur ?? '-'}</td>
                <td className="num">{r.aantal}</td>
                <td className="num stil">{r.inkoopprijs === null ? 'onbekend' : euro(r.inkoopprijs)}</td>
                <td className="num">{r.regelwaarde === null ? '-' : euro(r.regelwaarde)}</td>
                <td>
                  {r.klant_naam ? (
                    <span className="font-medium text-ink-900">{r.klant_naam}</span>
                  ) : (
                    <span className="stil">Geen klant</span>
                  )}
                  {r.order_id && r.ordernummer !== null && (
                    <>
                      {' '}
                      <Link href={`/dashboard/orders/${r.order_id}`} className="rij-link">
                        order {r.ordernummer}
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartijKaart({ partij, inkoopordersKlaar }: { partij: BestelPartijGroep; inkoopordersKlaar: boolean }) {
  const heeftPortaal = portaalLink(partij.bestelportaal_url) !== null;

  return (
    <form action={markeerRegelsBesteldActie} className="panel overflow-hidden">
      <input type="hidden" name="partij" value={partij.inkoopPartij} />
      {partij.merken.flatMap((m) => m.regels).map((r) => (
        <input key={r.id} type="hidden" name="alleRegelId" value={r.id} />
      ))}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-mist px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink-900">{partij.inkoopPartij}</h3>
          <p className="mt-0.5 text-[13px] text-warm">
            {meervoud(partij.merken.length, 'merk', 'merken')} · {meervoud(partij.aantalRegels, 'regel', 'regels')} ·{' '}
            <span className="font-semibold text-ink-900">{meervoud(partij.aantalStuks, 'stuk', 'stuks')}</span> ·
            inkoopwaarde <span className="font-semibold text-ink-900">{euro(partij.inkoopwaarde)}</span>
          </p>
          {partij.regelsZonderPrijs > 0 && (
            <p className="text-[12px] text-warm">
              Bij {meervoud(partij.regelsZonderPrijs, 'regel', 'regels')} staat geen inkoopprijs,{' '}
              {partij.regelsZonderPrijs === 1 ? 'die telt' : 'die tellen'} niet mee in dit bedrag.
            </p>
          )}
        </div>
        <BestelIngang partij={partij} />
      </div>

      <Contactregel partij={partij} />

      {partij.merken.map((m) => (
        // De bestelmail is alleen zinnig als er geen portaal is: bij Houweling
        // bestelt Jessi in de webshop, dan is een mailknop per merk ruis.
        <MerkBlok key={m.sleutel} merk={m} partij={partij} toonMailKnop={!heeftPortaal && Boolean(m.email)} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-mist px-4 py-3">
        <AllesAanvinken />
        <div className="flex flex-wrap items-center gap-2">
          {inkoopordersKlaar && (
            <button type="submit" formAction={maakInkooporderActie} className="knop-stil" title="Niets aangevinkt? Dan gaan alle regels van deze partij erin.">
              Maak inkooporder
            </button>
          )}
          <button type="submit" className="knop-donker">
            Aangevinkte regels op besteld zetten
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------- al besteld of geleverd */

function groepeer(regels: InkoopregelMetLeverancier[]) {
  const groepen = new Map<string, InkoopregelMetLeverancier[]>();
  for (const r of regels) {
    const sleutel = [r.merk, r.leverancier_naam].filter(Boolean).join(' · ') || 'Zonder merk/leverancier';
    const lijst = groepen.get(sleutel) ?? [];
    lijst.push(r);
    groepen.set(sleutel, lijst);
  }
  return [...groepen.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl'));
}

function Tabel({ groepen }: { groepen: [string, InkoopregelMetLeverancier[]][] }) {
  return (
    <div className="mt-4 flex flex-col gap-6">
      {groepen.map(([sleutel, regels]) => (
        <div key={sleutel} className="panel overflow-x-auto">
          <div className="border-b border-line bg-mist px-4 py-3">
            <h3 className="font-display text-sm font-bold text-ink-900">{sleutel}</h3>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Voor</th>
                <th scope="col">Maat / kleur</th>
                <th scope="col">Aantal</th>
                <th scope="col" className="hidden sm:table-cell">Besteld op</th>
                <th scope="col">Status</th>
                <th scope="col">Actie</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="font-semibold text-ink-900">{r.item_naam || '-'}</td>
                  <td className="stil">
                    {r.order_id ? <Link href={`/dashboard/orders/${r.order_id}`} className="rij-link">klantorder</Link> : 'voorraad'}
                  </td>
                  <td className="stil">{[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="stil">{r.aantal}x{r.geleverd_aantal ? ` (${r.geleverd_aantal} geleverd)` : ''}</td>
                  <td className="hidden whitespace-nowrap stil sm:table-cell">{fmt(r.besteld_op)}</td>
                  <td>
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${inkoopBadge[r.status] ?? 'bg-ink-100 text-ink-600'}`}>{inkoopLabel[r.status] ?? r.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {(r.status === 'besteld' || r.status === 'deels') && (
                        <>
                          <form action={markeerInkoop} className="flex items-center gap-1">
                            <input type="hidden" name="inkoopId" value={r.id} />
                            <input type="hidden" name="status" value="geleverd" />
                            <label className="sr-only" htmlFor={`geleverd-${r.id}`}>Aantal dat nu binnen is</label>
                            <input id={`geleverd-${r.id}`} name="ontvangen_nu" type="number" min="0" step="1" defaultValue={Math.max(0, r.aantal - (r.geleverd_aantal || 0))} className="w-16 rounded-md border border-line px-2 py-1 text-xs" />
                            <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Ontvangst boeken</button>
                          </form>
                          <form action={markeerInkoop}>
                            <input type="hidden" name="inkoopId" value={r.id} />
                            <input type="hidden" name="status" value="te_bestellen" />
                            <button type="submit" className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-800 hover:bg-mist">Terug naar te bestellen</button>
                          </form>
                        </>
                      )}
                      {r.status === 'geleverd' && <span className="text-xs text-warm">Afgehandeld</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ inkooporders */

const datumKort = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '-';

function Voortgang({ ontvangen, totaal }: { ontvangen: number; totaal: number }) {
  const pct = totaal > 0 ? Math.min(100, Math.round((ontvangen / totaal) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-[12px] text-warm">
        {ontvangen}/{totaal}
      </span>
    </div>
  );
}

function OrdersTabel({ orders }: { orders: InkooporderOverzicht[] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Inkooppartij</th>
            <th>Status</th>
            <th>Besteld</th>
            <th>Verwacht</th>
            <th>Ontvangen</th>
            <th className="text-right">Waarde</th>
            <th>Voor klantorder</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/dashboard/inkoop/${o.id}`} className="rij-link tabular-nums">
                  {o.nummer ?? '-'}
                </Link>
              </td>
              <td className="min-w-[160px]">
                <Link href={`/dashboard/inkoop/${o.id}`} className="font-semibold text-ink-900 hover:text-amber-700">
                  {o.inkoop_partij ?? 'Onbekend'}
                </Link>
                <span className="block truncate text-[11px] text-warm">
                  {o.merken.join(', ') || '-'} · {meervoud(o.aantalRegels, 'regel', 'regels')}
                </span>
              </td>
              <td>
                <span className={INKOOPORDER_BADGE[o.status] ?? 'badge-rust'}>{INKOOPORDER_LABEL[o.status] ?? o.status}</span>
              </td>
              <td className="whitespace-nowrap stil">{datumKort(o.besteld_op)}</td>
              <td className={`whitespace-nowrap ${o.teLaat ? 'font-semibold text-red-700' : 'stil'}`}>
                {datumKort(o.verwacht_op)}
                {o.teLaat && o.dagenTeLaat !== null && <span className="ml-1 text-[11px]">({o.dagenTeLaat} d te laat)</span>}
              </td>
              <td>
                <Voortgang ontvangen={o.ontvangenStuks} totaal={o.stuks} />
              </td>
              <td className="num">{euro(o.waarde)}</td>
              <td className="stil">
                {o.klantorders.length === 0
                  ? 'voorraad'
                  : o.klantorders.slice(0, 3).map((k, i) => (
                      <span key={k.id}>
                        {i > 0 && ', '}
                        <Link href={`/dashboard/orders/${k.id}`} className="rij-link" title={k.klant_naam ?? undefined}>
                          {k.ordernummer ?? 'order'}
                        </Link>
                      </span>
                    ))}
                {o.klantorders.length > 3 && ` +${o.klantorders.length - 3}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ pagina */

type Zoek = {
  ok?: string;
  aantal?: string;
  gemaild?: string;
  tab?: string;
  status?: string;
  partij?: string;
  periode?: string;
  order?: string;
};

const PO_CHIPS: { code: string; label: string }[] = [
  { code: 'open', label: 'onderweg' },
  { code: 'te_laat', label: 'te laat' },
  { code: 'concept', label: 'concept' },
  { code: 'verstuurd', label: 'verstuurd' },
  { code: 'deels_ontvangen', label: 'deels ontvangen' },
  { code: 'ontvangen', label: 'ontvangen' },
  { code: 'geannuleerd', label: 'geannuleerd' },
];

function tabUrl(tab: string) {
  return tab === 'werk' ? '/dashboard/inkoop' : `/dashboard/inkoop?tab=${tab}`;
}

export default async function InkoopPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sp = await searchParams;
  const { ok, aantal, gemaild } = sp;
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

  const [partijen, kpi, alleOrders, losse] = await Promise.all([
    teBestellenPerInkooppartij(),
    inkoopKpis(),
    listInkooporders({}),
    losseOpenRegels(),
  ]);
  const inkoopordersKlaar = alleOrders.klaar;
  const tab = sp.tab === 'orders' || sp.tab === 'regels' ? sp.tab : 'werk';

  // Inkooporders met filters (alleen als we die tab tonen). Eerst alles behalve
  // de status, voor de aantallen op de chips; daarna de status erover.
  const basisVoorChips =
    tab === 'orders' && (sp.partij || sp.periode || sp.order)
      ? (await listInkooporders({ partij: sp.partij, periode: sp.periode, ordernummer: sp.order })).orders
      : alleOrders.orders;
  const gefilterdeOrders = basisVoorChips.filter((o) => {
    if (!sp.status) return true;
    if (sp.status === 'open') return o.status === 'verstuurd' || o.status === 'deels_ontvangen';
    if (sp.status === 'te_laat') return o.teLaat;
    return o.status === sp.status;
  });
  const telPerStatus: Record<string, number> = {};
  for (const c of PO_CHIPS) telPerStatus[c.code] = 0;
  for (const o of basisVoorChips) {
    telPerStatus[o.status] = (telPerStatus[o.status] ?? 0) + 1;
    if (o.status === 'verstuurd' || o.status === 'deels_ontvangen') telPerStatus.open += 1;
    if (o.teLaat) telPerStatus.te_laat += 1;
  }
  const chipUrl = (code: string) => {
    const p = new URLSearchParams({ tab: 'orders' });
    if (code) p.set('status', code);
    if (sp.partij) p.set('partij', sp.partij);
    if (sp.periode) p.set('periode', sp.periode);
    if (sp.order) p.set('order', sp.order);
    return `/dashboard/inkoop?${p.toString()}`;
  };

  const totaalStuks = partijen.reduce((t, p) => t + p.aantalStuks, 0);
  const totaalWaarde = Math.round(partijen.reduce((t, p) => t + p.inkoopwaarde, 0) * 100) / 100;
  const totaalZonderPrijs = partijen.reduce((t, p) => t + p.regelsZonderPrijs, 0);
  const boodschap = melding(ok, aantal, gemaild);
  const openLosse = losse.filter((r) => r.status !== 'geleverd').length;

  const tabs = [
    { id: 'werk', label: 'Nog te bestellen', badge: kpi.teBestellenRegels },
    { id: 'orders', label: 'Inkooporders', badge: inkoopordersKlaar ? alleOrders.orders.filter((o) => o.status !== 'ontvangen' && o.status !== 'geannuleerd').length : null },
    { id: 'regels', label: inkoopordersKlaar ? 'Losse regels' : 'Besteld en geleverd', badge: openLosse || null },
  ];

  return (
    <main className="container-app pb-12">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Inkoop</h1>
        <Link href="/dashboard/voorraad?status=onder_minimum" className="knop-tekst">Voorraad onder minimum</Link>
      </div>

      {boodschap && (
        <p
          className={`mt-4 rounded-lg border px-4 py-2.5 text-[13px] font-semibold ${
            boodschap.waarschuwing ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {boodschap.tekst}
        </p>
      )}

      <section aria-label="Kerncijfers" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel
          label="Nog te bestellen"
          waarde={euro(kpi.teBestellenWaarde)}
          href="/dashboard/inkoop"
          sub={<span className="text-warm">{meervoud(kpi.teBestellenRegels, 'regel', 'regels')} nog niet besteld{kpi.concepten ? ', deels al in een concept' : ''}</span>}
        />
        <KpiTegel
          label="Open inkoopwaarde"
          waarde={euro(kpi.openWaarde)}
          href="/dashboard/inkoop?tab=orders&status=open"
          sub={<span className="text-warm">besteld, nog niet binnen · {meervoud(kpi.openRegels, 'regel', 'regels')}</span>}
        />
        <KpiTegel
          label="Te laat"
          waarde={kpi.teLaat === null ? '-' : String(kpi.teLaat)}
          href="/dashboard/inkoop?tab=orders&status=te_laat"
          sub={
            kpi.teLaat === null ? (
              <span className="text-warm">komt na de databasemigratie</span>
            ) : kpi.teLaat > 0 ? (
              <span className="font-semibold text-red-700">{euro(kpi.teLaatWaarde ?? 0)} over de verwachte datum</span>
            ) : (
              <span className="text-warm">alles binnen de verwachte datum</span>
            )
          }
        />
        <KpiTegel
          label="Deze week verwacht"
          waarde={kpi.dezeWeek === null ? '-' : String(kpi.dezeWeek)}
          href="/dashboard/inkoop?tab=orders&status=open&periode=week"
          sub={<span className="text-warm">{kpi.concepten ? `${meervoud(kpi.concepten, 'concept wacht', 'concepten wachten')} op versturen` : 'inkooporders met leverdatum deze week'}</span>}
        />
      </section>

      <nav aria-label="Onderdelen" className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => {
          const aan = t.id === tab;
          return (
            <Link
              key={t.id}
              href={tabUrl(t.id)}
              aria-current={aan ? 'page' : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                aan ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge !== 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${aan ? 'bg-amber-100 text-amber-800' : 'bg-mist text-warm'}`}>{t.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === 'werk' && (
        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="max-w-3xl dash-sub">
              Gegroepeerd per inkooppartij en daarbinnen per merk, zodat je bij Houweling alle merken in één sessie bestelt.
              {inkoopordersKlaar
                ? ' Maak er een inkooporder van om hem te kunnen volgen tot hij binnen is, of vink af als je al besteld hebt.'
                : ''}
            </p>
            {partijen.length > 0 && (
              <p className="text-[13px] text-warm">
                {meervoud(partijen.length, 'inkooppartij', 'inkooppartijen')} · {meervoud(totaalStuks, 'stuk', 'stuks')} · {euro(totaalWaarde)}
                {totaalZonderPrijs > 0 && ` (${meervoud(totaalZonderPrijs, 'regel', 'regels')} zonder inkoopprijs niet meegeteld)`}
              </p>
            )}
          </div>

          {partijen.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                titel="Niets te bestellen"
                tekst="Inkoopregels ontstaan als je een order goedkeurt of ze op de orderpagina genereert, en via Bijbestellen op de voorraadpagina."
                actieHref="/dashboard/voorraad?status=onder_minimum"
                actieLabel="Voorraad onder minimum bekijken"
              />
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-8">
              {partijen.map((p) => (
                <PartijKaart key={p.sleutel} partij={p} inkoopordersKlaar={inkoopordersKlaar} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'orders' && (
        <section className="mt-5">
          {!inkoopordersKlaar ? (
            <EmptyState
              titel="Inkooporders komen na de databasemigratie"
              tekst="Tot die gedraaid is, zie je bestelde regels onder Besteld en geleverd en kun je daar de ontvangst boeken."
              actieHref="/dashboard/inkoop?tab=regels"
              actieLabel="Naar besteld en geleverd"
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <UrlSelect param="partij" label="Leverancier" leegLabel="Alle inkooppartijen" opties={alleOrders.partijen.map((p) => ({ value: p, label: p }))} />
                <UrlSegment
                  param="periode"
                  label="Besteld in"
                  standaard=""
                  opties={[
                    { value: '', label: 'Altijd' },
                    { value: 'week', label: '7 dagen' },
                    { value: '30', label: '30 dagen' },
                    { value: '90', label: '90 dagen' },
                    { value: '365', label: 'Jaar' },
                  ]}
                />
                <LiveZoekveld param="order" placeholder="Bijv. 1042" label="Klantorder" breedte="w-40" vast={{ tab: 'orders' }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Link href={chipUrl('')} className={`chip ${sp.status ? '' : 'chip-aan'}`}>
                  Alle
                  <span className="chip-tel">{basisVoorChips.length}</span>
                </Link>
                {PO_CHIPS.filter((c) => telPerStatus[c.code] > 0 || sp.status === c.code).map((c) => (
                  <Link key={c.code} href={chipUrl(c.code)} className={`chip ${sp.status === c.code ? 'chip-aan' : ''}`}>
                    {c.label}
                    <span className="chip-tel">{telPerStatus[c.code]}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4">
                {gefilterdeOrders.length === 0 ? (
                  <EmptyState
                    tekst={alleOrders.orders.length === 0 ? 'Nog geen inkooporders. Maak er een vanuit Nog te bestellen.' : 'Geen inkooporders met deze filters.'}
                    actieHref={alleOrders.orders.length === 0 ? '/dashboard/inkoop' : '/dashboard/inkoop?tab=orders'}
                    actieLabel={alleOrders.orders.length === 0 ? 'Naar nog te bestellen' : 'Filters wissen'}
                  />
                ) : (
                  <OrdersTabel orders={gefilterdeOrders} />
                )}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'regels' && (
        <section className="mt-5">
          <p className="max-w-3xl dash-sub">
            {inkoopordersKlaar
              ? 'Regels die besteld zijn zonder inkooporder, van voor de inkooporders bestonden. Boek hier de ontvangst: voor een klantorder schuift de order op, anders gaat het de voorraad in.'
              : 'Bestelde regels. Boek de ontvangst per regel: voor een klantorder schuift de order op, anders gaat het de voorraad in.'}
          </p>
          {losse.length === 0 ? (
            <div className="mt-4">
              <EmptyState tekst="Geen losse bestelde regels." />
            </div>
          ) : (
            <Tabel groepen={groepeer(losse)} />
          )}
        </section>
      )}
    </main>
  );
}
