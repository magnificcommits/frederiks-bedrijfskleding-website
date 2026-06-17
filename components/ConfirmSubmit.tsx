'use client';

import { ReactNode } from 'react';

type Props = {
  /** Tekst in de bevestigingsdialoog. */
  message?: string;
  className?: string;
  children: ReactNode;
  /** name/value als de knop een waarde aan de form moet meegeven. */
  name?: string;
  value?: string;
};

/**
 * Submit-knop die eerst een bevestiging vraagt voordat de form (server action)
 * wordt verzonden. Plaats binnen een bestaande <form action={...}>.
 */
export default function ConfirmSubmit({
  message = 'Weet je het zeker? Dit kan niet ongedaan worden gemaakt.',
  className,
  children,
  name,
  value,
}: Props) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
