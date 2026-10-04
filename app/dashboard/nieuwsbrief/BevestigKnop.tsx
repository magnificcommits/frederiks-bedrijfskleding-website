'use client';
import { useBevestigKlik } from '@/components/dashboard/ui/useBevestigKlik';

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
  const onClick = useBevestigKlik(vraag, { children, className });
  return (
    <button
      type="submit"
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
