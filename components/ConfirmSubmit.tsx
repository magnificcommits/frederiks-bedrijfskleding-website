'use client';

import { ReactNode } from 'react';
import { useBevestigKlik } from '@/components/dashboard/ui/useBevestigKlik';

type Props = {
  /** Tekst in de bevestigingsdialoog. Een eerste zin met "?" wordt de titel. */
  message?: string;
  /** Optionele kop; dan is message de uitleg eronder. */
  titel?: string;
  /** Label van de bevestigknop; standaard de tekst van deze knop. */
  bevestigLabel?: string;
  className?: string;
  children: ReactNode;
  /** name/value als de knop een waarde aan de form moet meegeven. */
  name?: string;
  value?: string;
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
};

/**
 * Submit-knop die eerst een bevestiging vraagt voordat de form (server action)
 * wordt verzonden. Plaats binnen een bestaande <form action={...}>.
 * Het venster is het eigen bevestigingsvenster (focus op Annuleren bij
 * verwijderen, Escape sluit), niet het kale browservenster.
 */
export default function ConfirmSubmit({
  message = 'Weet je het zeker? Dit kan niet ongedaan worden gemaakt.',
  titel,
  bevestigLabel,
  className,
  children,
  name,
  value,
  disabled,
  title,
  'aria-label': ariaLabel,
}: Props) {
  const onClick = useBevestigKlik(message, { children, className, titel, bevestigLabel });
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
