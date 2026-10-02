'use client';
/* eslint-disable @next/next/no-img-element -- miniaturen van geüploade of externe afbeeldingen */

/**
 * Afbeelding kiezen (uploaden, url plakken of uit het assortiment) en een
 * product zoeken in de catalogus.
 */
import { useEffect, useRef, useState } from 'react';
import { uploadNieuwsbriefAfbeelding, zoekProducten, type ProductZoekResultaat } from '../actions';

/** Server actions nemen standaard maximaal 1 MB aan; we blijven daar ruim onder. */
const DOEL_BYTES = 900_000;
const MAX_BREEDTE = 1200;

function naarBlob(canvas: HTMLCanvasElement, type: string, kwaliteit?: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, type, kwaliteit));
}

/**
 * Verklein een foto in de browser tot max. 1200 px breed en onder ~0,9 MB,
 * zodat hij snel laadt in de mail en door de upload heen past.
 */
export async function verkleinAfbeelding(bestand: File): Promise<File | { fout: string }> {
  if (bestand.type === 'image/gif') {
    // Een bewegende GIF kunnen we niet verkleinen zonder de beweging kwijt te raken.
    return bestand.size <= DOEL_BYTES ? bestand : { fout: 'Deze GIF is te groot (maximaal 0,9 MB). Kies een kleinere.' };
  }
  const url = URL.createObjectURL(bestand);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('laden'));
      i.src = url;
    });
    if (img.naturalWidth <= MAX_BREEDTE && bestand.size <= DOEL_BYTES && /^image\/(png|jpeg)$/.test(bestand.type)) return bestand;

    const schaal = Math.min(1, MAX_BREEDTE / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * schaal));
    const h = Math.max(1, Math.round(img.naturalHeight * schaal));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { fout: 'Deze afbeelding kan niet worden verwerkt.' };
    const basisNaam = bestand.name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'afbeelding';

    // Een PNG (bv. een logo met doorzichtige achtergrond) houden we PNG als dat past.
    if (bestand.type === 'image/png') {
      ctx.drawImage(img, 0, 0, w, h);
      const png = await naarBlob(canvas, 'image/png');
      if (png && png.size <= DOEL_BYTES) return new File([png], `${basisNaam}.png`, { type: 'image/png' });
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      const jpg = await naarBlob(canvas, 'image/jpeg', q);
      if (jpg && jpg.size <= DOEL_BYTES) return new File([jpg], `${basisNaam}.jpg`, { type: 'image/jpeg' });
    }
    return { fout: 'Deze afbeelding blijft te groot, ook na verkleinen. Kies een andere.' };
  } catch {
    return { fout: 'Deze afbeelding kan niet worden geopend. Kies een PNG, JPG, GIF of WEBP.' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ */
/* Product zoeken                                                      */
/* ------------------------------------------------------------------ */

export function ProductZoeker({ onKies, autoFocus = false }: { onKies: (p: ProductZoekResultaat) => void; autoFocus?: boolean }) {
  const [term, setTerm] = useState('');
  const [resultaten, setResultaten] = useState<ProductZoekResultaat[]>([]);
  const [bezig, setBezig] = useState(false);
  const teller = useRef(0);

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setResultaten([]);
      setBezig(false);
      return;
    }
    const mijn = ++teller.current;
    setBezig(true);
    const timer = setTimeout(async () => {
      try {
        const r = await zoekProducten(t);
        if (mijn === teller.current) setResultaten(r);
      } finally {
        if (mijn === teller.current) setBezig(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  return (
    <div>
      <input
        autoFocus={autoFocus}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Zoek op naam, merk of artikelnummer"
        aria-label="Zoek een product"
        className="veld text-[14px]"
      />
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-line" aria-live="polite">
        {term.trim().length < 2 ? (
          <p className="px-3 py-2.5 text-[13px] text-warm">Typ minstens 2 letters.</p>
        ) : bezig && resultaten.length === 0 ? (
          <p className="px-3 py-2.5 text-[13px] text-warm">Zoeken...</p>
        ) : resultaten.length === 0 ? (
          <p className="px-3 py-2.5 text-[13px] text-warm">Niets gevonden.</p>
        ) : (
          resultaten.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onKies(p)}
              className="flex w-full items-center gap-3 border-b border-line px-2.5 py-2 text-left last:border-b-0 hover:bg-mist"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-mist">
                {p.foto ? <img src={p.foto} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-warm">geen foto</span>}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink-900">{p.naam}</span>
                <span className="block truncate text-[12px] text-warm">
                  {[p.merk, p.prijs !== null ? `€ ${p.prijs.toFixed(2).replace('.', ',')}` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Afbeelding kiezen                                                   */
/* ------------------------------------------------------------------ */

export type AfbeeldingKeuze = { src: string; alt?: string; link?: string };

export function AfbeeldingKiezer({
  src,
  onKies,
  metAssortiment = true,
  label = 'Afbeelding',
}: {
  src: string;
  onKies: (k: AfbeeldingKeuze) => void;
  metAssortiment?: boolean;
  label?: string;
}) {
  const [modus, setModus] = useState<null | 'url' | 'assortiment'>(null);
  const [url, setUrl] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const bestandRef = useRef<HTMLInputElement>(null);

  const upload = async (bestand: File | undefined) => {
    if (!bestand) return;
    setFout(null);
    setBezig(true);
    try {
      const klein = await verkleinAfbeelding(bestand);
      if (!(klein instanceof File)) {
        setFout(klein.fout);
        return;
      }
      const fd = new FormData();
      fd.append('bestand', klein);
      const uit = await uploadNieuwsbriefAfbeelding(fd);
      if ('url' in uit) onKies({ src: uit.url });
      else setFout(uit.fout);
    } catch {
      setFout('Uploaden is mislukt. Probeer het nog een keer.');
    } finally {
      setBezig(false);
      if (bestandRef.current) bestandRef.current.value = '';
    }
  };

  const zetUrl = () => {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u) && !u.startsWith('/')) {
      setFout('Plak een volledig adres dat begint met https://');
      return;
    }
    setFout(null);
    onKies({ src: u });
    setUrl('');
    setModus(null);
  };

  return (
    <div className="border-b border-line px-4 py-3">
      <span className="mb-2 block text-[13px] font-semibold text-ink-800">{label}</span>
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-mist">
          {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <span className="px-1 text-center text-[11px] text-warm">Nog geen afbeelding</span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <button type="button" onClick={() => bestandRef.current?.click()} disabled={bezig} className="knop-donker justify-center">
            {bezig ? 'Bezig met uploaden...' : 'Uploaden vanaf computer'}
          </button>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setModus(modus === 'url' ? null : 'url')} className={`knop-stil flex-1 justify-center ${modus === 'url' ? 'border-blue-400' : ''}`}>
              Url plakken
            </button>
            {metAssortiment && (
              <button
                type="button"
                onClick={() => setModus(modus === 'assortiment' ? null : 'assortiment')}
                className={`knop-stil flex-1 justify-center ${modus === 'assortiment' ? 'border-blue-400' : ''}`}
              >
                Uit assortiment
              </button>
            )}
          </div>
          {src && (
            <button type="button" onClick={() => onKies({ src: '' })} className="knop-tekst justify-start px-0 text-[12px] text-red-700">
              Afbeelding weghalen
            </button>
          )}
        </div>
      </div>
      <input
        ref={bestandRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
        aria-label="Kies een afbeelding om te uploaden"
      />
      {modus === 'url' && (
        <div className="mt-2 flex gap-1.5">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') zetUrl();
            }}
            placeholder="https://..."
            aria-label="Adres van de afbeelding"
            className="veld text-[13px]"
          />
          <button type="button" onClick={zetUrl} className="knop-donker">
            Gebruiken
          </button>
        </div>
      )}
      {modus === 'assortiment' && (
        <div className="mt-2">
          <ProductZoeker
            autoFocus
            onKies={(p) => {
              if (!p.foto) {
                setFout('Dit artikel heeft geen foto. Kies een ander artikel.');
                return;
              }
              setFout(null);
              onKies({ src: p.foto, alt: p.naam, link: p.url });
              setModus(null);
            }}
          />
        </div>
      )}
      {fout && (
        <p role="alert" className="mt-2 text-[12px] font-semibold text-red-700">
          {fout}
        </p>
      )}
      <p className="mt-2 text-[12px] leading-snug text-warm">Grote foto&apos;s worden automatisch verkleind, zodat de mail snel laadt.</p>
    </div>
  );
}
