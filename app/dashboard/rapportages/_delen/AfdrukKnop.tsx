'use client';

/** Opent het printvenster; daar kies je ook "Opslaan als pdf". */
export default function AfdrukKnop({ label = 'Afdrukken of pdf' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="knop-stil print:hidden">
      {label}
    </button>
  );
}
