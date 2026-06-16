'use client';

export default function PrintKnop() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
    >
      Print werkbon
    </button>
  );
}
