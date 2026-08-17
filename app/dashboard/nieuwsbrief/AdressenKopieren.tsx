'use client';

import { useState } from 'react';

/**
 * Kopieerknop plus CSV-export voor precies de adressen die nu in beeld staan.
 * Verstuurt zelf niets: de bedoeling is dat Jessi de regel in het bcc-veld van
 * haar eigen mailprogramma plakt.
 *
 * Kopiëren kent drie trappen, want `navigator.clipboard` bestaat alleen op een
 * https-pagina (of localhost) en ontbreekt in oudere browsers. Lukt het niet via
 * de browser, dan proberen we de oude execCommand-weg, en anders klapt het
 * tekstvak open met een melding erbij. Zonder die melding lijkt de knop het
 * gewoon te doen terwijl het klembord leeg blijft.
 */
export default function AdressenKopieren({
  mailregel,
  csv,
  aantal,
  bestandsnaam,
}: {
  mailregel: string;
  csv: string;
  aantal: number;
  bestandsnaam: string;
}) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const [toonTekst, setToonTekst] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  const leeg = aantal === 0;

  /** Terugval voor browsers zonder klembord-API: even een tekstvak in de pagina. */
  function kopieerViaTekstvak(tekst: string): boolean {
    try {
      const hulp = document.createElement('textarea');
      hulp.value = tekst;
      // Buiten beeld en readonly, anders springt de pagina en klapt op mobiel
      // het toetsenbord open.
      hulp.setAttribute('readonly', '');
      hulp.style.position = 'fixed';
      hulp.style.top = '-1000px';
      hulp.style.opacity = '0';
      document.body.appendChild(hulp);
      hulp.select();
      hulp.setSelectionRange(0, tekst.length);
      const gelukt = document.execCommand('copy');
      document.body.removeChild(hulp);
      return gelukt;
    } catch {
      return false;
    }
  }

  async function kopieer() {
    if (leeg) return;
    setMelding(null);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(mailregel);
        setGekopieerd(true);
        setTimeout(() => setGekopieerd(false), 4000);
        return;
      }
    } catch {
      // Valt hieronder door naar de terugval.
    }

    if (kopieerViaTekstvak(mailregel)) {
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 4000);
      return;
    }

    setGekopieerd(false);
    setToonTekst(true);
    setMelding(
      'Kopiëren lukte niet in deze browser. De adressen staan hieronder, klik in het vak en gebruik Ctrl+C om ze te kopiëren.',
    );
  }

  function exporteerCsv() {
    if (leeg) return;
    setMelding(null);
    // De BOM ervoor, anders maakt Excel van "Bouwbedrijf Küpers" een rij vraagtekens.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = bestandsnaam;
    // Firefox negeert een klik op een link die niet in de pagina hangt, en het
    // adres pas na een tel vrijgeven: anders is het bestand weg voordat de
    // browser het heeft opgehaald.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={kopieer} disabled={leeg} className="knop-donker disabled:opacity-50">
          {gekopieerd ? 'Gekopieerd' : `Kopieer ${aantal} ${aantal === 1 ? 'adres' : 'adressen'}`}
        </button>
        <button type="button" onClick={exporteerCsv} disabled={leeg} className="knop-stil disabled:opacity-50">
          Exporteer als CSV
        </button>
        <button
          type="button"
          onClick={() => setToonTekst((v) => !v)}
          disabled={leeg}
          className="knop-tekst disabled:opacity-50"
        >
          {toonTekst ? 'Verberg de adressen' : 'Toon de adressen'}
        </button>
      </div>

      {melding && (
        <p
          role="status"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800"
        >
          {melding}
        </p>
      )}

      {toonTekst && (
        <div className="mt-3">
          <label className="veld-label" htmlFor="nieuwsbrief-adressen">
            Alle adressen achter elkaar, klaar om in het bcc-veld te plakken
          </label>
          <textarea
            id="nieuwsbrief-adressen"
            readOnly
            rows={4}
            value={mailregel}
            onFocus={(e) => e.currentTarget.select()}
            className="veld font-mono text-[12px]"
          />
          <p className="veld-hint">
            Zet de adressen in bcc, niet in aan. Dan zien de klanten elkaars adres niet.
          </p>
        </div>
      )}
    </div>
  );
}
