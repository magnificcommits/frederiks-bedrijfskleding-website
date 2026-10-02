'use client';

/** Verzendknop die eerst om bevestiging vraagt (voor verwijderen e.d.). */
export default function BevestigKnop({
  vraag,
  children,
  className = 'knop-tekst text-red-700',
}: {
  vraag: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(vraag)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
