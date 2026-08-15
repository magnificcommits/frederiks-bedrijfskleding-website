'use client';

export default function PrintKnop({ label = 'Print document' }: { label?: string }) {
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
