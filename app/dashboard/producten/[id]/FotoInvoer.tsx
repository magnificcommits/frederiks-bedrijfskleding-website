'use client';

import { useEffect, useRef, useState } from 'react';
import { meetFoto, probleemUitleg, samenvatting, type FotoMeting } from '../fotocontrole/meten';

/**
 * Uploadveld en/of URL-veld voor een productfoto, met een controle direct na
 * het kiezen of plakken: is de foto groot genoeg, vierkant, scherp en vult het
 * product het beeld? Blokkeert niets; je ziet alleen meteen wat er niet klopt.
 *
 * De meting gaat als verborgen veld `foto_meting` mee, zodat de server hem bij
 * de foto kan bewaren voor de fotocontrole.
 */
export default function FotoInvoer({
  bestandNaam = 'afbeelding_bestand',
  urlNaam,
  bestandLabel = 'Afbeelding uploaden',
  urlLabel = 'Of plak een URL',
  bestandKlasse,
}: {
  bestandNaam?: string;
  /** Laat weg als er geen URL-veld bij hoort. */
  urlNaam?: string;
  bestandLabel?: string;
  urlLabel?: string;
  bestandKlasse: string;
}) {
  const [meting, setMeting] = useState<FotoMeting | null>(null);
  const [bezig, setBezig] = useState(false);
  const [url, setUrl] = useState('');
  const [heeftBestand, setHeeftBestand] = useState(false);
  const volgnummer = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function meet(bron: string | File) {
    const nr = ++volgnummer.current;
    setBezig(true);
    const m = await meetFoto(bron);
    if (nr !== volgnummer.current) return;
    setMeting(m);
    setBezig(false);
  }

  useEffect(() => {
    if (heeftBestand) return;
    if (timer.current) clearTimeout(timer.current);
    const t = url.trim();
    if (!/^(https?:\/\/|\/)/.test(t)) {
      if (!t) setMeting(null);
      return;
    }
    timer.current = setTimeout(() => void meet(t), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [url, heeftBestand]);

  const problemen = meting?.problemen ?? [];

  return (
    <>
      <div>
        <label className="veld-label">{bestandLabel}</label>
        <input
          type="file"
          name={bestandNaam}
          accept="image/*"
          className={bestandKlasse}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setHeeftBestand(!!f);
            if (f) void meet(f);
            else setMeting(null);
          }}
        />
      </div>
      {urlNaam && (
        <div>
          <label className="veld-label">{urlLabel}</label>
          <input name={urlNaam} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="veld" />
        </div>
      )}
      {meting && <input type="hidden" name="foto_meting" value={JSON.stringify(meting)} />}
      <div aria-live="polite" className="text-[12px] leading-snug">
        {bezig && <p className="text-warm">Foto wordt gecontroleerd…</p>}
        {!bezig && meting && (
          <div
            className={`rounded-md border px-3 py-2 ${problemen.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-900'}`}
          >
            <p className="font-semibold">{problemen.length ? 'Let op' : 'Foto ziet er goed uit'}</p>
            <p className="mt-0.5 tabular-nums">{samenvatting(meting)}</p>
            {problemen.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {problemen.map((p) => (
                  <li key={p}>{probleemUitleg(p, meting)}</li>
                ))}
              </ul>
            )}
            {meting.scherpte == null && meting.breedte != null && (
              <p className="mt-1 text-warm">Scherpte niet te meten: de site van deze foto staat dat niet toe.</p>
            )}
            {problemen.length > 0 && <p className="mt-1 text-warm">Je kunt de foto gewoon opslaan; dit is alleen een waarschuwing.</p>}
          </div>
        )}
      </div>
    </>
  );
}
