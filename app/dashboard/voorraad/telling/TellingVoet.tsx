'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Vaste balk onder de telling: hoeveel je hebt ingevuld, hoeveel afwijken van
 * het systeem, en de opslaanknop. Waarschuwt als je de pagina verlaat met
 * ingevulde maar niet opgeslagen tellingen; op een tablet tik je zo makkelijk
 * per ongeluk op terug.
 */
export default function TellingVoet({ totaal }: { totaal: number }) {
  const anker = useRef<HTMLDivElement>(null);
  const [ingevuld, setIngevuld] = useState(0);
  const [afwijkend, setAfwijkend] = useState(0);
  const verzonden = useRef(false);

  useEffect(() => {
    const form = anker.current?.closest('form');
    if (!form) return;
    const tel = () => {
      let n = 0;
      let af = 0;
      form.querySelectorAll<HTMLInputElement>('input[data-systeem]').forEach((i) => {
        if (i.value.trim() === '') {
          i.dataset.staat = '';
          return;
        }
        n += 1;
        const anders = Number(i.value) !== Number(i.dataset.systeem);
        if (anders) af += 1;
        i.dataset.staat = anders ? 'anders' : 'gelijk';
      });
      setIngevuld(n);
      setAfwijkend(af);
    };
    const opVerzend = () => {
      verzonden.current = true;
    };
    const opVerlaat = (e: BeforeUnloadEvent) => {
      if (verzonden.current) return;
      const iets = Array.from(form.querySelectorAll<HTMLInputElement>('input[data-systeem]')).some((i) => i.value.trim() !== '');
      if (iets) e.preventDefault();
    };
    form.addEventListener('input', tel);
    form.addEventListener('submit', opVerzend);
    window.addEventListener('beforeunload', opVerlaat);
    tel();
    return () => {
      form.removeEventListener('input', tel);
      form.removeEventListener('submit', opVerzend);
      window.removeEventListener('beforeunload', opVerlaat);
    };
  }, []);

  return (
    <div ref={anker} className="sticky bottom-0 max-md:bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 -mx-5 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <p className="text-[14px] text-ink-800">
        <span className="font-display text-lg font-bold tabular-nums">{ingevuld}</span> van {totaal} geteld
        {afwijkend > 0 && <span className="ml-2 badge-actie">{afwijkend} wijkt af</span>}
      </p>
      <input name="notitie" placeholder="Opmerking bij deze telling (optioneel)" className="veld max-w-xs flex-1" />
      <button type="submit" disabled={ingevuld === 0} className="knop-primair ml-auto px-5 py-2.5 text-[15px]">
        Telling opslaan
      </button>
    </div>
  );
}
