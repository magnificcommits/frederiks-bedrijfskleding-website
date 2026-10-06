'use client';

import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SortableTh from '@/components/dashboard/SortableTh';
import type { Mutatie, MutatieReden, VoorraadRij, VoorraadStatus } from '@/lib/kms/voorraad';
import {
  bijbestellenSelectieActie,
  haalHistorieActie,
  wijzigVoorraadActie,
  zetBijhoudenActie,
  zetLocatieActie,
} from './actions';

export type TabelRij = Pick<
  VoorraadRij,
  | 'variant_id' | 'product_id' | 'product_naam' | 'merk' | 'foto' | 'maat' | 'kleur' | 'locatie' | 'voorraad'
  | 'gereserveerd' | 'beschikbaar' | 'onderweg' | 'min_voorraad' | 'inkoopprijs' | 'inkoopwaarde' | 'bijhouden'
  | 'bijhoudenEigen' | 'status' | 'laatsteVerkoop'
> & { groep: string };

const REDENEN: { value: MutatieReden; label: string; uitleg: string }[] = [
  { value: 'telling', label: 'Telling', uitleg: 'Je hebt geteld wat er ligt' },
  { value: 'ontvangst', label: 'Ontvangst', uitleg: 'Er is iets binnengekomen' },
  { value: 'correctie', label: 'Correctie', uitleg: 'Fout rechtzetten' },
  { value: 'retour', label: 'Retour', uitleg: 'Klant bracht iets terug' },
];

const STATUS_BADGE: Record<VoorraadStatus, string> = {
  ok: 'badge-klaar',
  laag: 'badge-actie',
  op: 'badge bg-red-100 text-red-700',
  niet: 'badge-rust',
};
const STATUS_TEKST: Record<VoorraadStatus, string> = {
  ok: 'op voorraad',
  laag: 'laag',
  op: 'op',
  niet: 'niet op voorraad',
};
const REDEN_TEKST: Record<string, string> = {
  telling: 'Telling', ontvangst: 'Ontvangst', correctie: 'Correctie', retour: 'Retour', verkoop: 'Verkoop', instelling: 'Minimum',
};

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const datumTijd = (d: string) =>
  new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

type Melding = { tekst: string; fout: boolean } | null;

export default function VoorraadLijst({
  rijen,
  gegroepeerd,
  instellingenKlaar,
  mutatiesKlaar,
}: {
  rijen: TabelRij[];
  gegroepeerd: boolean;
  instellingenKlaar: boolean;
  mutatiesKlaar: boolean;
}) {
  const router = useRouter();
  const [reden, setReden] = useState<MutatieReden>('correctie');
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [melding, setMelding] = useState<Melding>(null);
  const [niveau, setNiveau] = useState<'product' | 'variant'>('product');
  const [bezig, start] = useTransition();

  // Een selectie van een vorige pagina of filter hoort niet stilletjes mee te gaan.
  const zichtbaar = new Set(rijen.map((r) => r.variant_id));
  const gekozen = [...selectie].filter((id) => zichtbaar.has(id));
  const allesAan = rijen.length > 0 && gekozen.length === rijen.length;

  useEffect(() => {
    if (!melding) return;
    const t = setTimeout(() => setMelding(null), 5000);
    return () => clearTimeout(t);
  }, [melding]);

  function wissel(id: string) {
    setSelectie((oud) => {
      const nieuw = new Set(oud);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });
  }

  function bulk(actie: () => Promise<{ ok: boolean; melding: string }>) {
    start(async () => {
      const res = await actie();
      setMelding({ tekst: res.melding, fout: !res.ok });
      if (res.ok) {
        setSelectie(new Set());
        router.refresh();
      }
    });
  }

  // Groepskoppen: telling per groep over de rijen op deze pagina.
  const perGroep = new Map<string, { n: number; laag: number; waarde: number }>();
  if (gegroepeerd) {
    for (const r of rijen) {
      const g = perGroep.get(r.groep) ?? { n: 0, laag: 0, waarde: 0 };
      g.n += 1;
      if (r.status === 'laag' || r.status === 'op') g.laag += r.bijhouden ? 1 : 0;
      g.waarde += r.inkoopwaarde;
      perGroep.set(r.groep, g);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-warm">Reden bij aanpassen</span>
          <div role="radiogroup" aria-label="Reden bij aanpassen" className="inline-flex rounded-md border border-line bg-mist p-0.5">
            {REDENEN.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reden === r.value}
                title={r.uitleg}
                onClick={() => setReden(r.value)}
                className={`rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  reden === r.value ? 'bg-ink-900 text-white' : 'text-warm hover:text-ink-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {!mutatiesKlaar && (
            <span className="text-[12px] text-warm">Historie wordt pas bewaard na de databasemigratie.</span>
          )}
        </div>
        <p className="text-[12px] text-warm">Typ een getal en druk op Enter of Tab. Opslaan gaat meteen.</p>
      </div>

      {melding && (
        <p
          role="status"
          className={`mt-3 rounded-md border px-3 py-2 text-[13px] font-semibold ${
            melding.fout ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {melding.tekst}
        </p>
      )}

      {gekozen.length > 0 && (
        <div className="sticky top-[3.5rem] z-20 mt-3 flex flex-wrap items-center gap-2 rounded-md border border-ink-900 bg-ink-900 px-3 py-2 text-[13px] text-white">
          <span className="font-semibold">{gekozen.length} geselecteerd</span>
          <span className="mx-1 h-4 w-px bg-white/30" aria-hidden />
          <label className="inline-flex items-center gap-1.5">
            <span className="text-white/70">Toepassen op</span>
            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value as 'product' | 'variant')}
              className="rounded border border-white/30 bg-ink-800 px-2 py-1 text-[12px] text-white"
            >
              <option value="product">hele product (alle maten)</option>
              <option value="variant">alleen deze maat/kleur</option>
            </select>
          </label>
          <button
            type="button"
            disabled={bezig || !instellingenKlaar}
            onClick={() => bulk(() => zetBijhoudenActie(gekozen, true, niveau))}
            className="knop bg-white text-ink-900 hover:bg-ink-50"
          >
            Voorraadartikel maken
          </button>
          <button
            type="button"
            disabled={bezig || !instellingenKlaar}
            onClick={() => bulk(() => zetBijhoudenActie(gekozen, false, niveau))}
            className="knop border border-white/30 text-white hover:bg-white/10"
          >
            Niet op voorraad houden
          </button>
          <button
            type="button"
            disabled={bezig}
            onClick={() => bulk(() => bijbestellenSelectieActie(gekozen))}
            className="knop border border-white/30 text-white hover:bg-white/10"
          >
            Bijbestellen tot minimum
          </button>
          <button type="button" onClick={() => setSelectie(new Set())} className="knop ml-auto text-white/80 hover:text-white">
            Selectie wissen
          </button>
          {!instellingenKlaar && <span className="w-full text-[12px] text-white/70">Voorraadartikel instellen kan pas na de databasemigratie.</span>}
        </div>
      )}

      <div className="panel mt-3 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Alles op deze pagina selecteren"
                  checked={allesAan}
                  onChange={() => setSelectie(allesAan ? new Set() : new Set(rijen.map((r) => r.variant_id)))}
                  className="h-4 w-4 accent-ink-900"
                />
              </th>
              <th className="w-12"><span className="sr-only">Foto</span></th>
              <SortableTh label="Product" col="product" />
              <SortableTh label="Kleur / maat" col="maat" />
              <SortableTh label="Op voorraad" col="voorraad" className="text-right" />
              <SortableTh label="Gereserveerd" col="gereserveerd" className="text-right" />
              <SortableTh label="Beschikbaar" col="beschikbaar" className="text-right" />
              <SortableTh label="Minimum" col="minimum" className="text-right" />
              <SortableTh label="Inkoopwaarde" col="waarde" className="text-right" />
              <SortableTh label="Status" col="status" />
              <th><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r, i) => {
              const nieuweGroep = gegroepeerd && (i === 0 || rijen[i - 1].groep !== r.groep);
              const g = perGroep.get(r.groep);
              const isOpen = open === r.variant_id;
              const stil = !r.bijhouden;
              return (
                <Fragment key={r.variant_id}>
                  {nieuweGroep && g && (
                    <tr className="bg-mist">
                      <td colSpan={11} className="!bg-mist !py-2">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-display text-[14px] font-bold text-ink-900">{r.groep}</span>
                          <span className="text-[12px] text-warm">
                            {g.n} {g.n === 1 ? 'regel' : 'regels'} op deze pagina · {euro.format(g.waarde)} inkoopwaarde
                          </span>
                          {g.laag > 0 && <span className="badge-actie">{g.laag} laag of op</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className={`${stil ? 'text-ink-400' : ''} ${selectie.has(r.variant_id) ? '[&>td]:!bg-amber-50' : ''}`}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${r.product_naam} ${r.kleur ?? ''} ${r.maat ?? ''} selecteren`}
                        checked={selectie.has(r.variant_id)}
                        onChange={() => wissel(r.variant_id)}
                        className="h-4 w-4 accent-ink-900"
                      />
                    </td>
                    <td className="!py-1">
                      {r.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.foto}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          className={`h-9 w-9 rounded border border-line bg-white object-contain ${stil ? 'opacity-50 grayscale' : ''}`}
                        />
                      ) : (
                        <span className="block h-9 w-9 rounded border border-dashed border-line bg-mist" aria-hidden />
                      )}
                    </td>
                    <td className="min-w-[200px]">
                      <Link href={`/dashboard/producten/${r.product_id}`} className={`rij-link ${stil ? '!font-medium !text-ink-500' : ''}`}>
                        {r.product_naam}
                      </Link>
                      <span className="block text-[11px] text-warm">
                        {r.merk ?? 'Geen merk'}
                        {r.locatie ? ` · ${r.locatie}` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      {r.kleur || '-'} <span className="text-ink-300">/</span> <span className="font-semibold">{r.maat || '-'}</span>
                    </td>
                    <td className="num">
                      <GetalCel variantId={r.variant_id} veld="voorraad" waarde={r.voorraad} reden={reden} stil={stil} onMelding={setMelding} />
                    </td>
                    <td className="num stil">{r.gereserveerd || '-'}</td>
                    <td className={`num font-semibold ${r.beschikbaar < 0 ? 'text-red-700' : stil ? '' : 'text-ink-900'}`}>
                      {r.bijhouden || r.beschikbaar !== 0 ? r.beschikbaar : '-'}
                      {r.onderweg > 0 && (
                        <span className="block text-[10px] font-medium text-warm" title="Bijbesteld, nog niet binnen">
                          +{r.onderweg} onderweg
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <GetalCel variantId={r.variant_id} veld="min_voorraad" waarde={r.min_voorraad} reden={reden} stil={stil} onMelding={setMelding} leegMag />
                    </td>
                    <td className="num stil">{r.inkoopwaarde > 0 ? euro.format(r.inkoopwaarde) : '-'}</td>
                    <td>
                      <span className={STATUS_BADGE[r.status]}>{STATUS_TEKST[r.status]}</span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : r.variant_id)}
                        aria-expanded={isOpen}
                        className="knop-tekst !px-1.5 !py-0.5 text-[12px]"
                      >
                        {isOpen ? 'Sluiten' : 'Historie'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={11} className="!bg-white !p-0">
                        <DetailPaneel rij={r} instellingenKlaar={instellingenKlaar} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Getal dat je in de tabel zelf aanpast. Slaat op bij Enter of als je het veld
 * verlaat, en alleen als het echt anders is. Daarna haalt de pagina de nieuwe
 * cijfers op (KPI's, status), zonder je filters of scrollpositie te verliezen.
 */
function GetalCel({
  variantId,
  veld,
  waarde,
  reden,
  stil,
  onMelding,
  leegMag = false,
}: {
  variantId: string;
  veld: 'voorraad' | 'min_voorraad';
  waarde: number | null;
  reden: MutatieReden;
  stil: boolean;
  onMelding: (m: Melding) => void;
  leegMag?: boolean;
}) {
  const router = useRouter();
  const origineel = waarde === null ? '' : String(waarde);
  const [tekst, setTekst] = useState(origineel);
  const [staat, setStaat] = useState<'rust' | 'bezig' | 'ok' | 'fout'>('rust');
  const veldRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (document.activeElement !== veldRef.current) setTekst(origineel);
  }, [origineel]);

  function opslaan() {
    const schoon = tekst.trim();
    if (schoon === origineel) return;
    if (schoon === '' && !leegMag) {
      setTekst(origineel);
      return;
    }
    setStaat('bezig');
    start(async () => {
      const res = await wijzigVoorraadActie(variantId, veld, schoon, reden);
      if (!res.ok) {
        setStaat('fout');
        setTekst(origineel);
        onMelding({ tekst: res.melding ?? 'Opslaan is niet gelukt.', fout: true });
        return;
      }
      setStaat('ok');
      setTimeout(() => setStaat('rust'), 1400);
      router.refresh();
    });
  }

  const rand =
    staat === 'ok' ? 'border-green-500 ring-2 ring-green-100' : staat === 'fout' ? 'border-red-400' : staat === 'bezig' ? 'border-amber-400' : 'border-transparent hover:border-line';

  return (
    <input
      ref={veldRef}
      inputMode="numeric"
      value={tekst}
      placeholder={leegMag ? '-' : '0'}
      onChange={(e) => setTekst(e.target.value.replace(/[^0-9]/g, ''))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={opslaan}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          opslaan();
        }
        if (e.key === 'Escape') {
          setTekst(origineel);
          e.currentTarget.blur();
        }
      }}
      aria-label={veld === 'voorraad' ? 'Op voorraad' : 'Minimum'}
      className={`w-14 rounded border bg-transparent px-1.5 py-0.5 text-right tabular-nums focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 ${rand} ${
        stil ? 'text-ink-400' : 'font-semibold text-ink-900'
      }`}
    />
  );
}

function DetailPaneel({ rij, instellingenKlaar }: { rij: TabelRij; instellingenKlaar: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<{ mutaties: Mutatie[]; klaar: boolean } | null>(null);
  const [locatie, setLocatie] = useState(rij.locatie ?? '');
  const [locStaat, setLocStaat] = useState<'rust' | 'ok' | 'fout'>('rust');
  const [, start] = useTransition();

  useEffect(() => {
    let weg = false;
    haalHistorieActie(rij.variant_id).then((d) => {
      if (!weg) setData(d);
    });
    return () => {
      weg = true;
    };
  }, [rij.variant_id, rij.voorraad, rij.min_voorraad]);

  function bewaarLocatie() {
    if ((rij.locatie ?? '') === locatie.trim()) return;
    start(async () => {
      const ok = await zetLocatieActie(rij.variant_id, locatie);
      setLocStaat(ok ? 'ok' : 'fout');
      if (ok) router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 border-y border-line bg-mist/50 px-4 py-4 md:grid-cols-[240px_1fr]">
      <dl className="space-y-2 text-[13px]">
        <div>
          <dt className="veld-label">Voorraadartikel</dt>
          <dd className="text-ink-900">
            {rij.bijhouden ? 'Ja' : 'Nee, besteld op order'}
            <span className="text-warm"> {rij.bijhoudenEigen ? '(ingesteld op deze maat)' : '(volgt het product)'}</span>
          </dd>
        </div>
        <div>
          <dt className="veld-label">Inkoopprijs</dt>
          <dd className="text-ink-900">{rij.inkoopprijs !== null ? euro.format(rij.inkoopprijs) : 'onbekend'}</dd>
        </div>
        <div>
          <dt className="veld-label">Laatst verkocht</dt>
          <dd className="text-ink-900">
            {rij.laatsteVerkoop ? new Date(rij.laatsteVerkoop).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Niet in de laatste 6 maanden'}
          </dd>
        </div>
        <div>
          <label className="veld-label" htmlFor={`loc-${rij.variant_id}`}>Locatie</label>
          <input
            id={`loc-${rij.variant_id}`}
            value={locatie}
            disabled={!instellingenKlaar}
            onChange={(e) => {
              setLocatie(e.target.value);
              setLocStaat('rust');
            }}
            onBlur={bewaarLocatie}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                bewaarLocatie();
              }
            }}
            placeholder="Bijv. schap B2 of bus"
            className={`veld ${locStaat === 'ok' ? 'border-green-500' : locStaat === 'fout' ? 'border-red-400' : ''}`}
          />
          <p className="veld-hint">{instellingenKlaar ? 'Handig voor de telling per locatie.' : 'Kan pas na de databasemigratie.'}</p>
        </div>
      </dl>

      <div>
        <p className="veld-label">Historie</p>
        {!data ? (
          <p className="text-[13px] text-warm">Historie ophalen...</p>
        ) : !data.klaar ? (
          <p className="text-[13px] text-warm">De historie wordt bijgehouden zodra de databasemigratie van 4 oktober gedraaid is.</p>
        ) : data.mutaties.length === 0 ? (
          <p className="text-[13px] text-warm">Nog niets gewijzigd aan deze maat en kleur.</p>
        ) : (
          <table className="tbl rounded-md border border-line bg-white">
            <thead>
              <tr>
                <th>Wanneer</th>
                <th>Reden</th>
                <th className="text-right">Van</th>
                <th className="text-right">Naar</th>
                <th className="text-right">Verschil</th>
                <th>Door</th>
              </tr>
            </thead>
            <tbody>
              {data.mutaties.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap stil">{datumTijd(m.created_at)}</td>
                  <td>
                    {REDEN_TEKST[m.soort] ?? m.soort}
                    {m.notitie && <span className="block text-[11px] text-warm">{m.notitie}</span>}
                  </td>
                  <td className="num stil">{m.oud ?? '-'}</td>
                  <td className="num font-semibold">{m.nieuw ?? '-'}</td>
                  <td className={`num ${m.verschil && m.verschil > 0 ? 'text-green-700' : m.verschil && m.verschil < 0 ? 'text-red-700' : 'stil'}`}>
                    {m.verschil == null ? '-' : m.verschil > 0 ? `+${m.verschil}` : m.verschil}
                  </td>
                  <td className="stil">{m.actor === 'dashboard-wachtwoord' ? 'gedeeld account' : m.actor ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
