'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PasdagGegevens } from '@/lib/kms/werknemers';
import { slaPasdagOpActie } from './actions';

type PasWerknemer = {
  id: string;
  naam: string;
  afdeling: string | null;
  opmerkingen: string | null;
};

/**
 * Pasdag bij de klant: per werknemer in één uitklapper alle artikelen uit zijn
 * assortiment (hele klant, zijn afdeling en wat specifiek voor hem is), met per
 * artikel de maat in de vaste assortimentkleur, eventueel een lengte en een
 * opmerking. Plus één opmerkingenveld voor vermaken en bijzonderheden.
 *
 * Gemaakt voor een tablet op locatie: grote velden, één knop om op te slaan en
 * meteen door te gaan naar de volgende werknemer.
 */
export default function PasdagMaten({
  orgId,
  werknemers,
  gegevens,
  startOpenId = null,
}: {
  orgId: string;
  werknemers: PasWerknemer[];
  gegevens: PasdagGegevens;
  /** Deze werknemer staat bij binnenkomst al open (net toegevoegd). */
  startOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(startOpenId);

  // Net toegevoegd: meteen naar zijn maten scrollen.
  useEffect(() => {
    if (!startOpenId) return;
    const t = setTimeout(
      () => document.getElementById(`pas-${startOpenId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      100,
    );
    return () => clearTimeout(t);
  }, [startOpenId]);
  const [zoek, setZoek] = useState('');
  const [alleenOpen, setAlleenOpen] = useState(false);

  const telling = useMemo(() => {
    const uit: Record<string, { ingevuld: number; totaal: number }> = {};
    for (const w of werknemers) {
      const sleutels = gegevens.perWerknemer[w.id] ?? [];
      const maten = gegevens.maten[w.id] ?? {};
      const ingevuld = sleutels.filter((s) => {
        const a = gegevens.artikelen[s];
        return Boolean(a && maten[a.product_id]?.maat);
      }).length;
      uit[w.id] = { ingevuld, totaal: sleutels.length };
    }
    return uit;
  }, [werknemers, gegevens]);

  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return werknemers.filter((w) => {
      if (term && !`${w.naam} ${w.afdeling ?? ''}`.toLowerCase().includes(term)) return false;
      if (alleenOpen) {
        const t = telling[w.id];
        if (t && t.totaal > 0 && t.ingevuld >= t.totaal) return false;
      }
      return true;
    });
  }, [werknemers, zoek, alleenOpen, telling]);

  function volgende(huidigId: string) {
    const i = zichtbaar.findIndex((w) => w.id === huidigId);
    const volgende = i >= 0 ? zichtbaar[i + 1] : undefined;
    setOpenId(volgende ? volgende.id : null);
    if (volgende) {
      // Na het openklappen naar de volgende werknemer scrollen.
      setTimeout(() => document.getElementById(`pas-${volgende.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }

  if (werknemers.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-mist px-5 py-4 text-[14px] text-warm">
        Voeg eerst werknemers toe. Daarna kun je hier per werknemer de maten noteren.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <label className="veld-label" htmlFor="pas-zoek">
            Werknemer zoeken
          </label>
          <input
            id="pas-zoek"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Naam of afdeling"
            autoComplete="off"
            className="veld py-2 text-[15px]"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-[14px] text-ink-900">
          <input
            type="checkbox"
            checked={alleenOpen}
            onChange={(e) => setAlleenOpen(e.target.checked)}
            className="h-4 w-4"
          />
          Alleen wie nog niet klaar is
        </label>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {zichtbaar.map((w) => {
          const t = telling[w.id] ?? { ingevuld: 0, totaal: 0 };
          const open = openId === w.id;
          const klaar = t.totaal > 0 && t.ingevuld >= t.totaal;
          return (
            <li key={w.id} id={`pas-${w.id}`} className={`panel ${open ? 'border-amber-300' : ''}`}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : w.id)}
                aria-expanded={open}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-ink-900">{w.naam}</span>
                  <span className="block text-[13px] text-warm">{w.afdeling ? `Afdeling ${w.afdeling}` : 'Geen afdeling'}</span>
                </span>
                <span className="flex items-center gap-3">
                  {t.totaal === 0 ? (
                    <span className="badge-rust">geen artikelen</span>
                  ) : klaar ? (
                    <span className="badge-klaar">alle maten ingevuld</span>
                  ) : (
                    <span className="badge-actie">
                      {t.ingevuld} van {t.totaal} maten
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-amber-700">{open ? 'Dichtklappen' : 'Maten invullen'}</span>
                </span>
              </button>
              {open && (
                <WerknemerMaten
                  key={w.id}
                  orgId={orgId}
                  werknemer={w}
                  gegevens={gegevens}
                  onVolgende={() => volgende(w.id)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {zichtbaar.length === 0 && (
        <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-[14px] text-warm">
          Geen werknemer gevonden met deze filter.
        </p>
      )}
    </div>
  );
}

type Rij = { maat: string; lengte: string; opmerking: string };

function WerknemerMaten({
  orgId,
  werknemer,
  gegevens,
  onVolgende,
}: {
  orgId: string;
  werknemer: PasWerknemer;
  gegevens: PasdagGegevens;
  onVolgende: () => void;
}) {
  const router = useRouter();
  const sleutels = gegevens.perWerknemer[werknemer.id] ?? [];
  const genoteerd = gegevens.maten[werknemer.id] ?? {};

  const [rijen, setRijen] = useState<Record<string, Rij>>(() => {
    const start: Record<string, Rij> = {};
    for (const s of sleutels) {
      const a = gegevens.artikelen[s];
      const m = a ? genoteerd[a.product_id] : undefined;
      start[s] = {
        maat: m?.maat ?? '',
        lengte: m?.lengte != null ? String(m.lengte) : '',
        opmerking: m?.opmerking ?? '',
      };
    }
    return start;
  });
  const [opmerkingen, setOpmerkingen] = useState(werknemer.opmerkingen ?? '');
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [bezig, start] = useTransition();

  function zet(sleutel: string, veld: keyof Rij, waarde: string) {
    setRijen((huidig) => ({ ...huidig, [sleutel]: { ...huidig[sleutel], [veld]: waarde } }));
    setMelding(null);
  }

  function opslaan(daarnaVolgende: boolean) {
    if (bezig) return;
    start(async () => {
      const antwoord = await slaPasdagOpActie({
        orgId,
        werknemerId: werknemer.id,
        opmerkingen,
        regels: sleutels
          .map((s) => {
            const a = gegevens.artikelen[s];
            if (!a) return null;
            const r = rijen[s];
            const lengte = r.lengte.trim() === '' ? null : Number(r.lengte.replace(',', '.'));
            return {
              product_id: a.product_id,
              kleur: a.kleur,
              maat: r.maat.trim() || null,
              lengte: lengte != null && Number.isFinite(lengte) ? lengte : null,
              opmerking: r.opmerking.trim() || null,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null),
      });
      setMelding({ ok: antwoord.ok, tekst: antwoord.melding });
      if (antwoord.ok) {
        router.refresh();
        if (daarnaVolgende) onVolgende();
      }
    });
  }

  return (
    <div className="border-t border-line px-4 py-4">
      {sleutels.length === 0 ? (
        <p className="rounded-lg border border-line bg-mist px-4 py-3 text-[14px] text-warm">
          Er staan nog geen artikelen in het assortiment voor deze werknemer. Voeg ze toe op het tabblad
          Assortiment, voor de hele klant of voor zijn afdeling.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-warm">
                <th className="pb-2 pr-3">Artikel</th>
                <th className="w-36 pb-2 pr-3">Maat</th>
                <th className="w-28 pb-2 pr-3">Lengte</th>
                <th className="pb-2">Opmerking</th>
              </tr>
            </thead>
            <tbody>
              {sleutels.map((s) => {
                const a = gegevens.artikelen[s];
                if (!a) return null;
                const r = rijen[s];
                const lijstId = `lengtes-${werknemer.id}-${a.product_id}`;
                return (
                  <tr key={s} className="border-t border-line align-middle">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-3">
                        {a.afbeelding ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={a.afbeelding} alt="" className="h-12 w-12 shrink-0 rounded border border-line bg-white object-contain" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">
                            geen foto
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink-900">{a.naam}</span>
                          <span className="block text-[12px] text-warm">
                            {[a.merk, a.kleur].filter(Boolean).join(' · ') || 'Geen kleur'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <label className="sr-only" htmlFor={`maat-${werknemer.id}-${s}`}>
                        Maat {a.naam}
                      </label>
                      {a.maten.length > 0 ? (
                        <select
                          id={`maat-${werknemer.id}-${s}`}
                          value={r.maat}
                          onChange={(e) => zet(s, 'maat', e.target.value)}
                          className="veld py-2 text-[15px]"
                        >
                          <option value="">Kies maat</option>
                          {/* Een eerder genoteerde maat die niet meer bestaat, blijft zichtbaar. */}
                          {r.maat && !a.maten.includes(r.maat) && <option value={r.maat}>{r.maat}</option>}
                          {a.maten.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`maat-${werknemer.id}-${s}`}
                          value={r.maat}
                          onChange={(e) => zet(s, 'maat', e.target.value)}
                          placeholder="Maat"
                          className="veld py-2 text-[15px]"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <label className="sr-only" htmlFor={`lengte-${werknemer.id}-${s}`}>
                        Lengte {a.naam}
                      </label>
                      <input
                        id={`lengte-${werknemer.id}-${s}`}
                        value={r.lengte}
                        onChange={(e) => zet(s, 'lengte', e.target.value)}
                        inputMode="numeric"
                        placeholder={a.maatwerk_lengte ? 'Lengte' : 'optioneel'}
                        list={a.lengtes.length > 0 ? lijstId : undefined}
                        className="veld py-2 text-[15px]"
                      />
                      {a.lengtes.length > 0 && (
                        <datalist id={lijstId}>
                          {a.lengtes.map((l) => (
                            <option key={l} value={l} />
                          ))}
                        </datalist>
                      )}
                    </td>
                    <td className="py-2">
                      <label className="sr-only" htmlFor={`opm-${werknemer.id}-${s}`}>
                        Opmerking {a.naam}
                      </label>
                      <input
                        id={`opm-${werknemer.id}-${s}`}
                        value={r.opmerking}
                        onChange={(e) => zet(s, 'opmerking', e.target.value)}
                        placeholder="Bijv. mouwen 3 cm korter"
                        className="veld py-2 text-[15px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <label className="veld-label" htmlFor={`opmerkingen-${werknemer.id}`}>
          Opmerkingen over kleding (vermaken, bijzonderheden)
        </label>
        <textarea
          id={`opmerkingen-${werknemer.id}`}
          value={opmerkingen}
          onChange={(e) => {
            setOpmerkingen(e.target.value);
            setMelding(null);
          }}
          rows={3}
          placeholder="Bijv. broek altijd 2 cm inkorten, linkshandig, draagt liever ruim"
          className="veld py-2 text-[15px]"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => opslaan(false)} disabled={bezig} className="knop-stil px-4 py-2.5 text-[15px]">
          {bezig ? 'Bezig...' : 'Opslaan'}
        </button>
        <button type="button" onClick={() => opslaan(true)} disabled={bezig} className="knop-donker px-4 py-2.5 text-[15px]">
          Opslaan en volgende werknemer
        </button>
        {melding && (
          <span className={`text-[14px] font-semibold ${melding.ok ? 'text-green-700' : 'text-red-700'}`}>{melding.tekst}</span>
        )}
      </div>
    </div>
  );
}
