'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { leesGeplakt, type Indeling } from './plakken';

type Rij = { sleutel: number; voornaam: string; achternaam: string; afdeling: string; email: string };

type Bestaand = { id: string; naam: string; afdeling_id: string | null; email: string | null };

/**
 * Werknemers snel invoeren: een tabel waarin Enter meteen een nieuwe rij geeft,
 * plus 'Plakken uit Excel'. Gebruikt in de wizard (stap Werknemers) en in het
 * venster Meerdere tegelijk op het tabblad Werknemers.
 *
 * Alles staat in de browser tot je op opslaan klikt; dan gaat de lijst als JSON
 * in één verborgen veld naar de server action. De knoppen komen van buiten
 * (`knoppen`), zodat de wizard Terug en Opslaan en verder kan tonen.
 */
export default function WerknemersInvoer({
  afdelingen,
  bestaande = [],
  actie,
  verborgen,
  knoppen,
  plakkenOpen = false,
}: {
  afdelingen: { id: string; naam: string }[];
  bestaande?: Bestaand[];
  actie: (formData: FormData) => void | Promise<void>;
  verborgen: Record<string, string>;
  knoppen: ReactNode;
  plakkenOpen?: boolean;
}) {
  const teller = useRef(1);
  const leeg = (): Rij => ({ sleutel: teller.current++, voornaam: '', achternaam: '', afdeling: '', email: '' });
  const [rijen, setRijen] = useState<Rij[]>(() => [leeg()]);
  const [wijzigingen, setWijzigingen] = useState<Record<string, string>>({});
  const [toonPlakken, setToonPlakken] = useState(plakkenOpen);
  const [plakTekst, setPlakTekst] = useState('');
  const [indeling, setIndeling] = useState<Indeling>('auto');
  const [melding, setMelding] = useState<string | null>(null);
  const velden = useRef(new Map<number, HTMLInputElement>());

  const afdelingOpNaam = useMemo(
    () => new Map(afdelingen.map((a) => [a.naam.trim().toLowerCase(), a.id])),
    [afdelingen],
  );

  // Afdelingen uit een geplakte lijst die nog niet bestaan: die worden bij opslaan aangemaakt.
  const nieuweNamen = useMemo(() => {
    const set = new Set<string>();
    for (const r of rijen) if (r.afdeling.startsWith('nieuw:')) set.add(r.afdeling.slice(6));
    return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
  }, [rijen]);

  const ingevuld = rijen.filter((r) => (r.voornaam + r.achternaam).trim());

  function zet(sleutel: number, veld: keyof Omit<Rij, 'sleutel'>, waarde: string) {
    setRijen((huidig) => huidig.map((r) => (r.sleutel === sleutel ? { ...r, [veld]: waarde } : r)));
  }

  function focusOp(sleutel: number) {
    setTimeout(() => velden.current.get(sleutel)?.focus(), 0);
  }

  // Enter = naar de volgende rij (en op de laatste rij: een nieuwe rij), niet versturen.
  function opToets(e: KeyboardEvent<HTMLInputElement>, sleutel: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = rijen.findIndex((r) => r.sleutel === sleutel);
    const volgende = rijen[i + 1];
    if (volgende) {
      focusOp(volgende.sleutel);
      return;
    }
    const nieuw = leeg();
    setRijen((huidig) => [...huidig, nieuw]);
    focusOp(nieuw.sleutel);
  }

  function rijErbij() {
    const nieuw = leeg();
    setRijen((huidig) => [...huidig, nieuw]);
    focusOp(nieuw.sleutel);
  }

  function weg(sleutel: number) {
    setRijen((huidig) => {
      const rest = huidig.filter((r) => r.sleutel !== sleutel);
      return rest.length > 0 ? rest : [leeg()];
    });
  }

  function afdelingWaarde(naam: string): string {
    const schoon = naam.trim();
    if (!schoon) return '';
    const id = afdelingOpNaam.get(schoon.toLowerCase());
    return id ? `id:${id}` : `nieuw:${schoon}`;
  }

  function plakInLijst() {
    const gelezen = leesGeplakt(plakTekst, indeling);
    if (gelezen.length === 0) {
      setMelding('Er stonden geen namen in. Plak één werknemer per regel.');
      return;
    }
    const nieuw = gelezen.map((g) => ({
      sleutel: teller.current++,
      voornaam: g.voornaam,
      achternaam: g.achternaam,
      afdeling: afdelingWaarde(g.afdeling),
      email: g.email,
    }));
    setRijen((huidig) => [...huidig.filter((r) => (r.voornaam + r.achternaam + r.email).trim()), ...nieuw]);
    setPlakTekst('');
    setToonPlakken(false);
    const nieuweAfd = new Set(nieuw.filter((r) => r.afdeling.startsWith('nieuw:')).map((r) => r.afdeling));
    setMelding(
      `${gelezen.length} ${gelezen.length === 1 ? 'naam' : 'namen'} in de lijst gezet.` +
        (nieuweAfd.size > 0
          ? ` ${nieuweAfd.size} ${nieuweAfd.size === 1 ? 'afdeling bestaat' : 'afdelingen bestaan'} nog niet en ${nieuweAfd.size === 1 ? 'wordt' : 'worden'} bij opslaan aangemaakt.`
          : '') +
        ' Controleer de lijst en sla op.',
    );
  }

  function afdelingVoorLege(waarde: string) {
    if (!waarde) return;
    setRijen((huidig) => huidig.map((r) => (r.afdeling ? r : { ...r, afdeling: waarde })));
  }

  const afdelingOpties = (
    <>
      <option value="">Geen afdeling</option>
      {afdelingen.map((a) => (
        <option key={a.id} value={`id:${a.id}`}>
          {a.naam}
        </option>
      ))}
      {nieuweNamen.map((n) => (
        <option key={`nieuw-${n}`} value={`nieuw:${n}`}>
          {n} (nieuw)
        </option>
      ))}
    </>
  );

  const wijzigLijst = Object.entries(wijzigingen).map(([id, afdeling]) => ({ id, afdeling }));

  return (
    <form action={actie} className="flex flex-col gap-5">
      {Object.entries(verborgen).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        type="hidden"
        name="rijen"
        value={JSON.stringify(
          ingevuld.map((r) => ({ voornaam: r.voornaam, achternaam: r.achternaam, afdeling: r.afdeling, email: r.email })),
        )}
      />
      <input type="hidden" name="bestaand" value={JSON.stringify(wijzigLijst)} />

      {bestaande.length > 0 && (
        <div>
          <p className="text-[14px] font-semibold text-ink-900">Al aangemaakt ({bestaande.length})</p>
          <p className="text-[13px] text-warm">Je kunt hier nog de afdeling aanpassen.</p>
          <div className="panel mt-2 max-h-72 overflow-y-auto">
            <table className="tbl">
              <tbody>
                {bestaande.map((w) => (
                  <tr key={w.id}>
                    <td className="font-semibold text-ink-900">{w.naam}</td>
                    <td className="stil">{w.email || '—'}</td>
                    <td className="w-56">
                      {afdelingen.length === 0 ? (
                        <span className="text-[13px] text-warm">Geen afdelingen</span>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`best-afd-${w.id}`}>
                            Afdeling van {w.naam}
                          </label>
                          <select
                            id={`best-afd-${w.id}`}
                            value={wijzigingen[w.id] ?? (w.afdeling_id ? `id:${w.afdeling_id}` : '')}
                            onChange={(e) => setWijzigingen((h) => ({ ...h, [w.id]: e.target.value }))}
                            className="veld py-1.5"
                          >
                            <option value="">Geen afdeling</option>
                            {afdelingen.map((a) => (
                              <option key={a.id} value={`id:${a.id}`}>
                                {a.naam}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-ink-900">
              {bestaande.length > 0 ? 'Nieuwe werknemers' : 'Werknemers'}
            </p>
            <p className="text-[13px] text-warm">
              Typ een naam en druk op Enter voor de volgende. E-mail is optioneel (nodig om zelf te bestellen in het
              portaal).
            </p>
          </div>
          <button type="button" onClick={() => setToonPlakken((v) => !v)} className="knop-stil">
            {toonPlakken ? 'Plakken sluiten' : 'Plakken uit Excel'}
          </button>
        </div>

        {toonPlakken && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <label className="veld-label" htmlFor="plak-tekst">
              Plak hier de lijst
            </label>
            <textarea
              id="plak-tekst"
              value={plakTekst}
              onChange={(e) => setPlakTekst(e.target.value)}
              rows={6}
              placeholder={'Jan de Vries\tLassers\nPetra Jansen\tKantoor\nAhmed Yilmaz'}
              className="veld font-mono text-[13px]"
            />
            <p className="veld-hint">
              Selecteer in Excel de kolommen met naam (en eventueel afdeling en e-mail), kopieer en plak hier. Eén
              werknemer per regel. Alleen namen mag ook.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="veld-label" htmlFor="plak-indeling">
                  Wat staat er in de kolommen?
                </label>
                <select
                  id="plak-indeling"
                  value={indeling}
                  onChange={(e) => setIndeling(e.target.value as Indeling)}
                  className="veld"
                >
                  <option value="auto">Zelf herkennen</option>
                  <option value="naam">Naam | Afdeling</option>
                  <option value="voorachter">Voornaam | Achternaam | Afdeling</option>
                </select>
              </div>
              <button type="button" onClick={plakInLijst} className="knop-donker" disabled={!plakTekst.trim()}>
                Zet in de lijst
              </button>
            </div>
          </div>
        )}

        {melding && (
          <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-[13px] text-green-800">
            {melding}
          </p>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-warm">
                <th className="pb-1 pr-2">Voornaam</th>
                <th className="pb-1 pr-2">Achternaam</th>
                <th className="pb-1 pr-2">Afdeling</th>
                <th className="pb-1 pr-2">E-mail (optioneel)</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {rijen.map((r, i) => (
                <tr key={r.sleutel}>
                  <td className="py-1 pr-2">
                    <label className="sr-only" htmlFor={`wn-v-${r.sleutel}`}>
                      Voornaam rij {i + 1}
                    </label>
                    <input
                      id={`wn-v-${r.sleutel}`}
                      ref={(el) => {
                        if (el) velden.current.set(r.sleutel, el);
                        else velden.current.delete(r.sleutel);
                      }}
                      value={r.voornaam}
                      onChange={(e) => zet(r.sleutel, 'voornaam', e.target.value)}
                      onKeyDown={(e) => opToets(e, r.sleutel)}
                      autoComplete="off"
                      className="veld"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <label className="sr-only" htmlFor={`wn-a-${r.sleutel}`}>
                      Achternaam rij {i + 1}
                    </label>
                    <input
                      id={`wn-a-${r.sleutel}`}
                      value={r.achternaam}
                      onChange={(e) => zet(r.sleutel, 'achternaam', e.target.value)}
                      onKeyDown={(e) => opToets(e, r.sleutel)}
                      autoComplete="off"
                      className="veld"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <label className="sr-only" htmlFor={`wn-afd-${r.sleutel}`}>
                      Afdeling rij {i + 1}
                    </label>
                    <select
                      id={`wn-afd-${r.sleutel}`}
                      value={r.afdeling}
                      onChange={(e) => zet(r.sleutel, 'afdeling', e.target.value)}
                      className="veld"
                    >
                      {afdelingOpties}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <label className="sr-only" htmlFor={`wn-e-${r.sleutel}`}>
                      E-mail rij {i + 1}
                    </label>
                    <input
                      id={`wn-e-${r.sleutel}`}
                      type="email"
                      value={r.email}
                      onChange={(e) => zet(r.sleutel, 'email', e.target.value)}
                      onKeyDown={(e) => opToets(e, r.sleutel)}
                      autoComplete="off"
                      className="veld"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => weg(r.sleutel)}
                      className="knop-tekst"
                      aria-label={`Rij ${i + 1} weghalen`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={rijErbij} className="knop-stil">
            Rij toevoegen
          </button>
          {(afdelingen.length > 0 || nieuweNamen.length > 0) && rijen.some((r) => !r.afdeling) && (
            <label className="flex items-center gap-2 text-[13px] text-warm">
              Lege afdelingen invullen met
              <select value="" onChange={(e) => afdelingVoorLege(e.target.value)} className="veld w-44 py-1.5">
                <option value="">kies…</option>
                {afdelingen.map((a) => (
                  <option key={a.id} value={`id:${a.id}`}>
                    {a.naam}
                  </option>
                ))}
                {nieuweNamen.map((n) => (
                  <option key={`nieuw-${n}`} value={`nieuw:${n}`}>
                    {n} (nieuw)
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="mt-2 text-[13px] text-warm">
          {ingevuld.length === 0
            ? 'Nog geen nieuwe namen ingevuld.'
            : `${ingevuld.length} ${ingevuld.length === 1 ? 'nieuwe werknemer' : 'nieuwe werknemers'} klaar om op te slaan.`}
        </p>
      </div>

      {knoppen}
    </form>
  );
}
