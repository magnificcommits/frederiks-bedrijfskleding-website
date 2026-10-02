'use client';

/**
 * Voorbeeld van de echte mail: precies dezelfde HTML als die verstuurd wordt
 * (renderNieuwsbrief, stand 'voorbeeld'), in een afgeschermd iframe. Met een
 * schakelaar tussen computer (breedte van het ontwerp) en telefoon (375 px).
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderNieuwsbrief } from '@/lib/nieuwsbrief/render';
import type { Ontwerp } from '@/lib/nieuwsbrief/types';
import { IcoonComputer, IcoonTelefoon } from './iconen';

export default function Voorbeeld({ ontwerp, naam, siteUrl, onSluit }: { ontwerp: Ontwerp; naam: string; siteUrl: string; onSluit: () => void }) {
  const [stand, setStand] = useState<'desktop' | 'mobiel'>('desktop');
  const html = useMemo(() => renderNieuwsbrief(ontwerp, { onderwerp: naam, modus: 'voorbeeld', siteUrl }), [ontwerp, naam, siteUrl]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSluit();
    };
    document.addEventListener('keydown', esc);
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = oud;
    };
  }, [onSluit]);

  // Desktop: breedte van de brief plus de ruimte eromheen; telefoon: 375 px.
  const breedte = stand === 'mobiel' ? 375 : ontwerp.instellingen.breedte + 80;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Voorbeeld van de nieuwsbrief" className="fixed inset-0 z-[100] flex flex-col bg-ink-900/70">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
        <div>
          <p className="text-[15px] font-bold text-ink-900">Voorbeeld</p>
          <p className="text-[12px] text-warm">Zo ziet de ontvanger de mail. Persoonlijke velden zoals {'{{naam}}'} worden bij het versturen ingevuld.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Schermgrootte" className="inline-flex overflow-hidden rounded-md border border-line">
            {(
              [
                ['desktop', 'Computer', <IcoonComputer key="c" />],
                ['mobiel', 'Telefoon', <IcoonTelefoon key="t" />],
              ] as const
            ).map(([id, label, icoon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={stand === id}
                onClick={() => setStand(id)}
                className={`flex items-center gap-1.5 border-l border-line px-3 py-1.5 text-[13px] font-semibold first:border-l-0 ${
                  stand === id ? 'bg-blue-50 text-blue-700' : 'bg-white text-ink-700 hover:bg-mist'
                }`}
              >
                {icoon}
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onSluit} className="knop-donker">
            Sluiten
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-6" onClick={onSluit}>
        <iframe
          title="Voorbeeld van de nieuwsbrief"
          srcDoc={html}
          sandbox=""
          onClick={(e) => e.stopPropagation()}
          className={`h-full shrink-0 border border-line bg-white shadow-card transition-[width] duration-200 ${stand === 'mobiel' ? 'rounded-[28px] border-[10px] border-ink-900' : 'rounded-lg'}`}
          style={{ width: stand === 'mobiel' ? breedte + 20 : breedte, maxWidth: '100%' }}
        />
      </div>
    </div>,
    document.body,
  );
}
