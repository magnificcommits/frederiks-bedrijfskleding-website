'use client';

/** Knop die het afdrukvenster opent (A4). Wordt zelf niet afgedrukt. */
export default function PrintKnop({ tekst = 'Afdrukken', className = 'knop-donker' }: { tekst?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`print:hidden ${className}`}>
      {tekst}
    </button>
  );
}
