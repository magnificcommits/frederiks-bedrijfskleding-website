'use client';

export default function PrintKnop({ label = 'Afdrukken / PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="knop-donker"
    >
      {label}
    </button>
  );
}
