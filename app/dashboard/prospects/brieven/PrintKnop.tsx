'use client';

export default function PrintKnop({ aantal }: { aantal: number }) {
  return (
    <button type="button" onClick={() => window.print()} className="knop-primair">
      Afdrukken ({aantal} {aantal === 1 ? 'brief' : 'brieven'})
    </button>
  );
}
