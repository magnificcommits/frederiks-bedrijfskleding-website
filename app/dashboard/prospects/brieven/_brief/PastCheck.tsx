'use client';

import { useEffect, useState } from 'react';

const PX_PER_MM = 96 / 25.4;

export type TeLang = { id: string; naam: string; mm: number };

/** Meet per brief hoeveel millimeter de blokken onder de beschikbare ruimte uitkomen. */
export function meetBrieven(container: ParentNode): TeLang[] {
  const uit: TeLang[] = [];
  container.querySelectorAll<HTMLElement>('[data-brief]').forEach((brief) => {
    const inhoud = brief.querySelector<HTMLElement>('[data-brief-inhoud]');
    if (!inhoud) return;
    const over = inhoud.scrollHeight - inhoud.clientHeight;
    if (over > 1) uit.push({ id: brief.dataset.id ?? '', naam: brief.dataset.naam ?? 'Brief', mm: Math.ceil(over / PX_PER_MM) });
  });
  return uit;
}

/**
 * Controle in de print- en voorbeeldweergave: past elke brief op één A4? Brieven
 * die te lang zijn krijgen een rode rand (niet op papier) en staan in de melding,
 * met hoeveel er af moet.
 */
export default function PastCheck({ containerId, totaal }: { containerId: string; totaal: number }) {
  const [teLang, setTeLang] = useState<TeLang[] | null>(null);

  useEffect(() => {
    const el = document.getElementById(containerId);
    if (!el) return;
    let stop = false;
    const meet = () => {
      if (stop) return;
      const lijst = meetBrieven(el);
      el.querySelectorAll<HTMLElement>('[data-brief]').forEach((b) => {
        if (lijst.some((l) => l.id === b.dataset.id)) b.setAttribute('data-te-lang', '');
        else b.removeAttribute('data-te-lang');
      });
      setTeLang(lijst);
    };
    meet();
    // Lettertypes en foto's kunnen de tekst nog laten verspringen.
    void document.fonts?.ready.then(meet);
    window.addEventListener('load', meet);
    const t = setTimeout(meet, 1200);
    return () => {
      stop = true;
      clearTimeout(t);
      window.removeEventListener('load', meet);
    };
  }, [containerId, totaal]);

  return (
    <>
      <style>{`[data-te-lang]{outline:3px solid #dc2626;outline-offset:2px}@media print{[data-te-lang]{outline:none}}`}</style>
      {teLang === null ? (
        <p className="text-[13px] text-warm print:hidden">Brieven worden gemeten…</p>
      ) : teLang.length === 0 ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800 print:hidden" role="status">
          Alle {totaal} {totaal === 1 ? 'brief past' : 'brieven passen'} op één A4.
        </p>
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800 print:hidden" role="alert">
          <p className="font-semibold">
            {teLang.length} {teLang.length === 1 ? 'brief is' : 'brieven zijn'} te lang voor één A4. Het onderste stuk valt eraf.
          </p>
          <p className="mt-1">
            {teLang.slice(0, 8).map((l) => `${l.naam} (${l.mm} mm)`).join(', ')}
            {teLang.length > 8 ? ` en nog ${teLang.length - 8}` : ''}. Maak de tekst korter of de kleding kleiner in stap 2. Lange bedrijfsnamen maken een regel soms net langer.
          </p>
        </div>
      )}
    </>
  );
}
