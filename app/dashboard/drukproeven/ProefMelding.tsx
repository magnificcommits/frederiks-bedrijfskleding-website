'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Melding na een drukproefactie die niet in de algemene toast past, omdat er
 * meer uitleg bij hoort (?dp=...). Werkt op het overzicht én op de klantkaart.
 */
const TEKSTEN: Record<string, { tekst: string; fout?: boolean }> = {
  mail_uit: {
    tekst:
      'De mail staat nog niet aan, dus er is niets verstuurd. Kopieer de link onder de proef en stuur hem zelf naar de klant. Klik daarna op "Link gedeeld", dan staat de proef op ter goedkeuring.',
    fout: true,
  },
  mail_fout: {
    tekst: 'Versturen is niet gelukt. Controleer het e-mailadres, of deel de link onder de proef zelf.',
    fout: true,
  },
  verstuurd_handmatig: { tekst: 'De proef staat op ter goedkeuring. Keurt de klant hem via de link goed, dan zie je dat hier.' },
  goedgekeurd: { tekst: 'Goedgekeurd namens de klant. Hangt de proef aan een order, dan staat die nu klaar voor productie.' },
  mislukt: { tekst: 'Dat is niet gelukt. Probeer het nog een keer.', fout: true },
  weg: { tekst: 'Deze drukproef bestaat niet meer, of is al door de klant beoordeeld.', fout: true },
};

export default function ProefMelding() {
  const sp = useSearchParams();
  const code = sp.get('dp');
  const m = code ? TEKSTEN[code] : null;
  if (!m) return null;
  return (
    <p
      role={m.fout ? 'alert' : 'status'}
      className={`mt-4 rounded-xl border px-5 py-3 text-sm font-semibold ${
        m.fout ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'
      }`}
    >
      {m.tekst}
    </p>
  );
}
