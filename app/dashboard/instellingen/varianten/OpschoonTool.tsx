'use client';
import { bevestig } from '@/components/dashboard/ui/Bevestig';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { OpschoonRij } from '@/lib/kms/varianten';
import { KLEURGROEPEN, alleMaten, type VariantLijsten } from '@/lib/kms/variantenStandaard';
import { KleurStaal } from '@/app/dashboard/producten/VariantKiezer';
import { omzettenActie, type OmzetUitkomst } from './actions';

/**
 * Opschoontool: alle bestaande maat- en kleurwaarden naast de vaste lijst.
 *
 * - Per waarde staat een voorstel klaar (uit normaliseerKleur/normaliseerMaat).
 *   Je kunt het doel per regel aanpassen of een selectie in één keer op een
 *   standaardwaarde zetten.
 * - Er wordt niets geschreven tot je op "Omzetten" klikt en de vraag met het
 *   aantal varianten bevestigt.
 * - De oude schrijfwijze wordt als alias onthouden, zodat een volgende import
 *   hem zelf herkent.
 */

const STATUS_LABEL: Record<OpschoonRij['status'], string> = {
  goed: 'Al goed',
  zeker: 'Past op standaard',
  nieuw: 'Nieuwe tweekleur',
  onbekend: 'Zelf kiezen',
};

const nl = (n: number) => n.toLocaleString('nl-NL');

export default function OpschoonTool({ rijen, lijst, kanOpslaan }: { rijen: OpschoonRij[]; lijst: VariantLijsten; kanOpslaan: boolean }) {
  const router = useRouter();
  const [veld, setVeld] = useState<'kleur' | 'maat'>('kleur');
  const [statusFilter, setStatusFilter] = useState<'tedoen' | OpschoonRij['status']>('tedoen');
  const [zoek, setZoek] = useState('');
  const [doel, setDoel] = useState<Record<string, string>>({});
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [bulkDoel, setBulkDoel] = useState('');
  const [leerAlias, setLeerAlias] = useState(true);
  const [uitkomst, setUitkomst] = useState<OmzetUitkomst | null>(null);
  const [bezig, start] = useTransition();

  const kleurNamen = useMemo(() => new Map(lijst.kleuren.filter((k) => k.actief !== false).map((k) => [k.naam.toLowerCase(), k])), [lijst]);
  const maatNamen = useMemo(() => new Set(alleMaten(lijst).map((m) => m.maat)), [lijst]);
  const groepVolgorde = useMemo(() => new Map<string, number>(KLEURGROEPEN.map((g, i) => [g.id, i])), []);

  const vanVeld = useMemo(() => rijen.filter((r) => r.veld === veld), [rijen, veld]);
  const sleutel = (r: OpschoonRij) => `${r.veld}\u0000${r.waarde}`;
  const doelVan = (r: OpschoonRij) => doel[sleutel(r)] ?? r.voorstel ?? '';

  /** Nieuwe tweekleuren die uit voorstellen komen; die worden bij het omzetten aangemaakt. */
  const voorstelKleuren = useMemo(() => {
    const m = new Map<string, NonNullable<OpschoonRij['nieuweKleur']>>();
    for (const r of rijen) if (r.nieuweKleur) m.set(r.nieuweKleur.naam.toLowerCase(), r.nieuweKleur);
    return m;
  }, [rijen]);

  const doelGeldig = (d: string) =>
    !!d && (veld === 'kleur' ? kleurNamen.has(d.toLowerCase()) || voorstelKleuren.has(d.toLowerCase()) : maatNamen.has(d));

  const tellingen = useMemo(() => {
    const t = { tedoen: 0, goed: 0, zeker: 0, nieuw: 0, onbekend: 0 } as Record<string, number>;
    const v = { tedoen: 0, goed: 0, zeker: 0, nieuw: 0, onbekend: 0 } as Record<string, number>;
    for (const r of vanVeld) {
      t[r.status]++;
      v[r.status] += r.varianten;
      if (r.status !== 'goed') {
        t.tedoen++;
        v.tedoen += r.varianten;
      }
    }
    return { t, v };
  }, [vanVeld]);

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return vanVeld
      .filter((r) => (statusFilter === 'tedoen' ? r.status !== 'goed' : r.status === statusFilter))
      .filter((r) => !z || r.waarde.toLowerCase().includes(z) || (r.voorstel ?? '').toLowerCase().includes(z))
      .sort((a, b) => b.varianten - a.varianten || a.waarde.localeCompare(b.waarde, 'nl'));
  }, [vanVeld, statusFilter, zoek]);

  // Wat er gaat gebeuren als je nu op Omzetten klikt.
  const plan = useMemo(() => {
    const paren: { van: string; naar: string }[] = [];
    let varianten = 0;
    const nieuw = new Map<string, NonNullable<OpschoonRij['nieuweKleur']>>();
    const ongeldig: string[] = [];
    for (const r of vanVeld) {
      if (!gekozen.has(sleutel(r))) continue;
      const d = doelVan(r).trim();
      if (!d || d === r.waarde) continue;
      if (!doelGeldig(d)) {
        ongeldig.push(r.waarde);
        continue;
      }
      const naam = veld === 'kleur' ? (kleurNamen.get(d.toLowerCase())?.naam ?? voorstelKleuren.get(d.toLowerCase())?.naam ?? d) : d;
      paren.push({ van: r.waarde, naar: naam });
      varianten += r.varianten;
      if (veld === 'kleur' && !kleurNamen.has(d.toLowerCase())) {
        const v = voorstelKleuren.get(d.toLowerCase());
        if (v) nieuw.set(v.naam.toLowerCase(), v);
      }
    }
    return { paren, varianten, nieuw: [...nieuw.values()], ongeldig };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vanVeld, gekozen, doel, veld, kleurNamen, maatNamen, voorstelKleuren]);

  function wisselVeld(v: 'kleur' | 'maat') {
    setVeld(v);
    setGekozen(new Set());
    setBulkDoel('');
    setUitkomst(null);
  }

  function selecteer(alleen?: OpschoonRij['status'][]) {
    setGekozen((oud) => {
      const nieuw = new Set(oud);
      for (const r of zichtbaar) if ((!alleen || alleen.includes(r.status)) && doelVan(r) && doelVan(r) !== r.waarde) nieuw.add(sleutel(r));
      return nieuw;
    });
  }

  function pasBulkToe() {
    const d = bulkDoel.trim();
    if (!d) return;
    setDoel((oud) => {
      const nieuw = { ...oud };
      for (const r of vanVeld) if (gekozen.has(sleutel(r))) nieuw[sleutel(r)] = d;
      return nieuw;
    });
  }

  async function omzetten() {
    if (plan.paren.length === 0) return;
    const regels = [
      `${nl(plan.varianten)} varianten worden aangepast (${plan.paren.length} ${plan.paren.length === 1 ? 'waarde' : 'waarden'}).`,
      plan.nieuw.length ? `${plan.nieuw.length} nieuwe ${plan.nieuw.length === 1 ? 'kleur wordt' : 'kleuren worden'} aangemaakt: ${plan.nieuw.slice(0, 6).map((k) => k.naam).join(', ')}${plan.nieuw.length > 6 ? ' …' : ''}.` : '',
      leerAlias ? 'De oude schrijfwijze wordt onthouden als alias.' : '',
      veld === 'kleur' ? 'De leverancierswaarde (met kleurcode) blijft bewaard bij elke variant. Kleurfoto’s en klantassortimenten gaan mee.' : 'De leverancierswaarde blijft bewaard bij elke variant.',
    ].filter((r) => r !== '');
    if (!(await bevestig({ titel: 'Waarden omzetten?', tekst: regels.join('\n'), bevestigLabel: 'Omzetten' }))) return;
    start(async () => {
      const r = await omzettenActie({ veld, paren: plan.paren, nieuweKleuren: plan.nieuw, leerAlias });
      setUitkomst(r);
      if (r.ok) {
        setGekozen(new Set());
        router.refresh();
      }
    });
  }

  const opties =
    veld === 'kleur'
      ? [...lijst.kleuren]
          .filter((k) => k.actief !== false)
          .sort((a, b) => (groepVolgorde.get(a.groep) ?? 99) - (groepVolgorde.get(b.groep) ?? 99) || a.volgorde - b.volgorde)
          .map((k) => k.naam)
      : [...maatNamen];
  const lijstId = `doel-${veld}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-line p-0.5" role="group" aria-label="Wat wil je opschonen?">
          {(['kleur', 'maat'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => wisselVeld(v)}
              aria-pressed={veld === v}
              className={`rounded px-3 py-1 text-[13px] font-semibold ${veld === v ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-mist'}`}
            >
              {v === 'kleur' ? 'Kleuren' : 'Maten'}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-warm">
          {nl(vanVeld.length)} verschillende {veld === 'kleur' ? 'kleurwaarden' : 'maatwaarden'} in de varianten,{' '}
          <strong className="font-semibold text-ink-900">{nl(tellingen.t.tedoen)}</strong> wijken af van de vaste lijst ({nl(tellingen.v.tedoen)} varianten).
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(['tedoen', 'zeker', ...(veld === 'kleur' ? (['nieuw'] as const) : []), 'onbekend', 'goed'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`chip ${statusFilter === s ? 'chip-aan' : ''}`}>
            {s === 'tedoen' ? 'Te doen' : STATUS_LABEL[s]}
            <span className="chip-tel">{nl(tellingen.t[s] ?? 0)}</span>
          </button>
        ))}
        <input
          type="search"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek een waarde"
          aria-label="Zoek een waarde"
          className="veld ml-auto w-56"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-mist px-3 py-2 text-[13px]">
        <span className="font-semibold text-ink-900">{nl(gekozen.size)} geselecteerd</span>
        <button type="button" className="knop-stil" onClick={() => selecteer(['zeker'])}>Selecteer alles wat op een standaard past</button>
        {veld === 'kleur' && <button type="button" className="knop-stil" onClick={() => selecteer(['nieuw'])}>Selecteer nieuwe tweekleuren</button>}
        {gekozen.size > 0 && <button type="button" className="knop-tekst" onClick={() => setGekozen(new Set())}>Selectie wissen</button>}
        <span className="ml-auto flex items-center gap-1.5">
          <label htmlFor="bulk-doel" className="text-warm">Selectie omzetten naar</label>
          <input id="bulk-doel" list={lijstId} value={bulkDoel} onChange={(e) => setBulkDoel(e.target.value)} className="veld w-44" placeholder={veld === 'kleur' ? 'bijv. Zwart' : 'bijv. 2XL'} />
          <button type="button" className="knop-stil" onClick={pasBulkToe} disabled={!gekozen.size || !doelGeldig(bulkDoel.trim())}>Toepassen</button>
        </span>
      </div>
      <datalist id={lijstId}>
        {opties.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {zichtbaar.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">
          {statusFilter === 'tedoen' ? 'Alles in deze lijst staat al goed.' : 'Geen waarden in deze selectie.'}
        </p>
      ) : (
        <div className="panel mt-3 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Alles in deze lijst selecteren"
                    checked={zichtbaar.every((r) => gekozen.has(sleutel(r)))}
                    onChange={(e) =>
                      setGekozen((oud) => {
                        const n = new Set(oud);
                        for (const r of zichtbaar) {
                          if (e.target.checked) n.add(sleutel(r));
                          else n.delete(sleutel(r));
                        }
                        return n;
                      })
                    }
                  />
                </th>
                <th>Huidige waarde</th>
                <th className="text-right">Varianten</th>
                <th className="text-right">Producten</th>
                <th>Wordt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {zichtbaar.slice(0, 400).map((r) => {
                const k = sleutel(r);
                const d = doelVan(r);
                const geldig = !d || doelGeldig(d);
                const kleur = veld === 'kleur' ? (kleurNamen.get(d.toLowerCase()) ?? voorstelKleuren.get(d.toLowerCase())) : null;
                const isNieuw = veld === 'kleur' && !!d && !kleurNamen.has(d.toLowerCase()) && voorstelKleuren.has(d.toLowerCase());
                return (
                  <tr key={k} className={gekozen.has(k) ? 'bg-amber-50/60' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${r.waarde} selecteren`}
                        checked={gekozen.has(k)}
                        onChange={(e) =>
                          setGekozen((oud) => {
                            const n = new Set(oud);
                            if (e.target.checked) n.add(k);
                            else n.delete(k);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td>
                      <span className="whitespace-pre font-mono text-[12px] text-ink-900">{r.waarde}</span>
                    </td>
                    <td className="num">{nl(r.varianten)}</td>
                    <td className="num stil">{nl(r.producten)}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        {kleur && <KleurStaal hex={kleur.hex} hex2={'hex2' in kleur ? kleur.hex2 : null} />}
                        <input
                          list={lijstId}
                          value={d}
                          onChange={(e) => setDoel((oud) => ({ ...oud, [k]: e.target.value }))}
                          aria-label={`Nieuwe waarde voor ${r.waarde}`}
                          aria-invalid={!geldig || undefined}
                          placeholder="Kies een standaard"
                          className={`veld w-48 ${!geldig ? 'border-red-400' : ''}`}
                        />
                        {isNieuw && <span className="badge-actie">wordt aangemaakt</span>}
                      </span>
                      {!geldig && <span className="mt-0.5 block text-[11px] text-red-700">Staat niet in de vaste lijst. Voeg hem eerst toe.</span>}
                    </td>
                    <td>
                      <span className={r.status === 'goed' ? 'badge-klaar' : r.status === 'onbekend' ? 'badge-actie' : 'badge-rust'}>{STATUS_LABEL[r.status]}</span>
                      {r.reeks && <span className="ml-1 text-[11px] text-warm">{r.reeks}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {zichtbaar.length > 400 && <p className="px-3 py-2 text-[12px] text-warm">De eerste 400 van {nl(zichtbaar.length)} staan hier; zoek om de rest te zien.</p>}
        </div>
      )}

      <div className="sticky bottom-0 max-md:bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 -mx-1 mt-4 rounded-t-lg border border-line bg-white px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-ink-900" aria-live="polite">
            {plan.paren.length === 0 ? (
              <span className="text-warm">Selecteer waarden en controleer het doel. Er wordt pas iets aangepast als je op Omzetten klikt.</span>
            ) : (
              <>
                <strong className="font-semibold">{nl(plan.varianten)} varianten</strong> worden aangepast ({plan.paren.length}{' '}
                {plan.paren.length === 1 ? 'waarde' : 'waarden'})
                {plan.nieuw.length > 0 && <>, {plan.nieuw.length} nieuwe {plan.nieuw.length === 1 ? 'kleur' : 'kleuren'}</>}.
              </>
            )}
            {plan.ongeldig.length > 0 && (
              <span className="ml-2 text-red-700">{plan.ongeldig.length} geselecteerd met een doel dat niet in de lijst staat; die worden overgeslagen.</span>
            )}
          </p>
          <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={leerAlias} onChange={(e) => setLeerAlias(e.target.checked)} />
            Oude schrijfwijze onthouden als alias
          </label>
          <button type="button" className="knop-primair" onClick={omzetten} disabled={!kanOpslaan || bezig || plan.paren.length === 0}>
            {bezig ? 'Bezig met omzetten…' : 'Omzetten'}
          </button>
        </div>
        {!kanOpslaan && <p className="mt-1 text-[12px] text-amber-800">Omzetten kan pas als de migratie is gedraaid. Je kunt wel al kijken wat er zou veranderen.</p>}
        {uitkomst && !uitkomst.ok && <p className="mt-2 text-[13px] font-semibold text-red-700">{uitkomst.fout}</p>}
        {uitkomst && uitkomst.ok && (
          <p className="mt-2 text-[13px] text-green-800">
            Klaar: {nl(uitkomst.omgezet)} varianten omgezet
            {uitkomst.overgeslagen > 0 && (
              <>
                , {nl(uitkomst.overgeslagen)} overgeslagen omdat hetzelfde product die {veld} en {veld === 'kleur' ? 'maat' : 'kleur'} al had (die staan nog in de lijst; kijk ze na op de productpagina)
              </>
            )}
            {uitkomst.fotos > 0 && <>, {nl(uitkomst.fotos)} kleurfoto&apos;s meeverhuisd</>}
            {uitkomst.aliassen > 0 && <>, {nl(uitkomst.aliassen)} aliassen onthouden</>}
            {uitkomst.nieuweKleuren > 0 && <>, {nl(uitkomst.nieuweKleuren)} kleuren aangemaakt</>}.
          </p>
        )}
      </div>
    </div>
  );
}
