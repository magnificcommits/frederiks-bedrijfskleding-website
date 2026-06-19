'use client';

export default function PrintKnop({ label = 'Afdrukken / PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist"
    >
      {label}
    </button>
  );
}
