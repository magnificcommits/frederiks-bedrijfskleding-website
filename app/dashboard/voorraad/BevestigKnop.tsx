'use client';
import { useBevestigKlik } from '@/components/dashboard/ui/useBevestigKlik';

/**
 * Verzendknop met een bevestigingsvraag ervoor. Voor acties die iets klaarzetten
 * of versturen dat je niet met één klik terug wilt hoeven draaien.
 */
export default function BevestigKnop({
  vraag,
  children,
  className = 'knop-stil',
  disabled = false,
  name,
  value,
  formAction,
}: {
  vraag: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const onClick = useBevestigKlik(vraag, { children, className });
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
