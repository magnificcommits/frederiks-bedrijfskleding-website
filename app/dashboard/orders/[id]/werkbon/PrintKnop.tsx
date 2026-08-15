'use client';

export default function PrintKnop() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="knop-donker"
    >
      Print werkbon
    </button>
  );
}
