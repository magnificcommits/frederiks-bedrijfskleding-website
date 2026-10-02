'use client';
import { useState } from 'react';

/**
 * Kopieert een tekst naar het klembord. navigator.clipboard bestaat alleen op
 * https of localhost; anders de oude execCommand-weg, en lukt dat ook niet dan
 * selecteren we de tekst zodat Jessi zelf Ctrl+C kan doen.
 */
export default function KopieerKnop({ tekst, label = 'Kopieer' }: { tekst: string; label?: string }) {
  const [stand, setStand] = useState<'rust' | 'ok' | 'zelf'>('rust');

  async function kopieer() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(tekst);
        setStand('ok');
        return;
      }
    } catch {
      // val door naar de oude manier
    }
    try {
      const hulp = document.createElement('textarea');
      hulp.value = tekst;
      hulp.setAttribute('readonly', '');
      hulp.style.position = 'fixed';
      hulp.style.left = '-9999px';
      document.body.appendChild(hulp);
      hulp.select();
      const gelukt = document.execCommand('copy');
      document.body.removeChild(hulp);
      setStand(gelukt ? 'ok' : 'zelf');
    } catch {
      setStand('zelf');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={kopieer} className="knop-stil">{stand === 'ok' ? 'Gekopieerd' : label}</button>
      {stand === 'zelf' && <span className="text-[12px] text-warm">Kopiëren lukte niet, selecteer de link en druk op Ctrl+C.</span>}
    </span>
  );
}
