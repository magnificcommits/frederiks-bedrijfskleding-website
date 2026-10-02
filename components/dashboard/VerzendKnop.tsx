'use client';
import { useFormStatus } from 'react-dom';

/**
 * Verzendknop voor een <form action={serverActie}> die laat zien dat er gewerkt
 * wordt: tekst wordt `bezigTekst`, er draait een rondje en de knop gaat uit tot
 * de server klaar is. Voor acties die even duren (logo zoeken, mail versturen).
 */
export default function VerzendKnop({
  children,
  bezigTekst = 'Bezig…',
  className = 'knop-primair',
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  bezigTekst?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${className} inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-80`}
    >
      {pending && (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {pending ? bezigTekst : children}
    </button>
  );
}
