'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Garment } from '@/components/Garments';
import { kleuren } from '@/content/configurator';
import { track } from '@/lib/analytics';

/**
 * Werkend voorproefje van de pakketsamensteller op de homepage: kledingstuk,
 * kleur en logo kiezen en het resultaat meteen zien. De keuze gaat via
 * sessionStorage mee naar /pakket-samenstellen, zodat de bezoeker daar verdergaat
 * waar hij was. Zonder upload staat er een voorbeeldlogo, zodat je direct ziet
 * wat het doet.
 */
const TYPES = [
  { id: 'polo', label: 'Polo' },
  { id: 'softshell', label: 'Softshell' },
  { id: 'sweater', label: 'Sweater' },
  { id: 'werkbroek', label: 'Werkbroek' },
];

/** Voorbeeldlogo in een kleur die op het gekozen kledingstuk te zien is. */
function voorbeeldLogo(inkt: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect x="4" y="4" width="112" height="82" rx="10" fill="none" stroke="${inkt}" stroke-width="7"/><text x="60" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="24" fill="${inkt}">JOUW</text><text x="60" y="70" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="24" fill="${inkt}">LOGO</text></svg>`,
    )
  );
}

export const PROEF_SLEUTEL = 'fb-pakket-proef';

export function PakketProef() {
  const [type, setType] = useState('polo');
  const [kleur, setKleur] = useState(0);
  const [rug, setRug] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [fout, setFout] = useState('');
  const bestand = useRef<HTMLInputElement>(null);
  const k = kleuren[kleur];
  const positie = type === 'werkbroek' ? 'dijbeen-rechts' : rug ? 'rug' : 'borst-links';

  function kiesBestand(f: File | undefined) {
    setFout('');
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type) || f.size > 2_000_000) {
      setFout('Kies een PNG, JPG, WEBP of SVG tot 2 MB.');
      return;
    }
    const lezer = new FileReader();
    lezer.onload = () => {
      setLogo(String(lezer.result));
      track('cta_klik', { cta: 'pakket_proef_logo' });
    };
    lezer.readAsDataURL(f);
  }

  function bewaar() {
    try {
      sessionStorage.setItem(PROEF_SLEUTEL, JSON.stringify({ type, kleur, positie, logo }));
    } catch {
      // Opslag vol of geblokkeerd: de samensteller begint dan gewoon leeg.
    }
  }

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-2xl bg-white text-ink-900 shadow-card sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
      <div className="relative flex items-center justify-center bg-mist p-6">
        <div className="aspect-square w-full max-w-[19rem]">
          <Garment type={type} color={k.hex} light={k.licht} logo={logo ?? voorbeeldLogo(k.licht || k.name.startsWith('Hi-vis') || k.name === 'Grijs' ? '#1c1c1c' : '#ffffff')} pos={positie} techniek="borduren" />
        </div>
        <p className="absolute bottom-3 left-4 text-xs font-semibold text-warm" aria-live="polite">
          {TYPES.find((t) => t.id === type)?.label}, {k.name.toLowerCase()}
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <fieldset>
          <legend className="text-sm font-bold text-ink-900">Kledingstuk</legend>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={type === t.id}
                onClick={() => setType(t.id)}
                className={`min-h-[44px] rounded-lg border-2 px-2 text-sm font-semibold transition ${type === t.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 hover:border-ink-900'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-ink-900">Kleur</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {kleuren.map((c, i) => (
              <button
                key={c.name}
                type="button"
                aria-pressed={kleur === i}
                aria-label={c.name}
                title={c.name}
                onClick={() => setKleur(i)}
                className={`h-9 w-9 rounded-full border-2 transition ${kleur === i ? 'border-amber-500 ring-2 ring-amber-500 ring-offset-2' : 'border-ink-200 hover:border-ink-900'}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </fieldset>

        <div>
          <p className="text-sm font-bold text-ink-900">Logo</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => bestand.current?.click()} className="min-h-[44px] rounded-lg border-2 border-ink-200 px-3 text-sm font-semibold transition hover:border-ink-900">
              {logo ? 'Ander logo' : 'Upload je logo'}
            </button>
            {type !== 'werkbroek' && (
              <button type="button" aria-pressed={rug} onClick={() => setRug((r) => !r)} className="min-h-[44px] rounded-lg border-2 border-ink-200 px-3 text-sm font-semibold transition hover:border-ink-900">
                {rug ? 'Toon de borst' : 'Toon de rug'}
              </button>
            )}
          </div>
          <input ref={bestand} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => kiesBestand(e.target.files?.[0])} />
          {fout && <p className="mt-2 text-sm font-medium text-amber-700" role="alert">{fout}</p>}
        </div>

        <Link href="/pakket-samenstellen" onClick={bewaar} className="btn-primary mt-auto w-full" data-cta="pakket">
          Verder met dit ontwerp
        </Link>
      </div>
    </div>
  );
}
