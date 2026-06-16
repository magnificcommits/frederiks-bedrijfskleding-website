'use client';

export default function PrintKnop() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist"
    >
      Afdrukken
    </button>
  );
}
