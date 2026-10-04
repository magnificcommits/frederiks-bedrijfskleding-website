import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import InfoTip from './InfoTip';

type InvoerProps = {
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

/**
 * Eén formulierveld: label boven het veld, korte hulptekst eronder, foutmelding
 * in rood onder het veld en een rood sterretje bij verplicht. Het label hangt
 * via `id` aan het invoerveld; hulp- en fouttekst via aria-describedby, zodat
 * een schermlezer ze voorleest.
 *
 *   <Veld id="email" label="E-mailadres" verplicht hint="Hier gaat de factuur heen.">
 *     <input name="email" type="email" className="veld" />
 *   </Veld>
 */
export default function Veld({
  id,
  label,
  hint,
  fout,
  verplicht = false,
  info,
  className = '',
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  fout?: ReactNode;
  verplicht?: boolean;
  /** Korte uitleg achter een (i)-knopje naast het label. */
  info?: ReactNode;
  className?: string;
  children: ReactElement<InvoerProps>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const foutId = fout ? `${id}-fout` : undefined;
  const beschrijving = [children.props['aria-describedby'], hintId, foutId].filter(Boolean).join(' ') || undefined;

  const invoer = isValidElement(children)
    ? cloneElement(children, {
        id,
        required: children.props.required ?? (verplicht || undefined),
        'aria-describedby': beschrijving,
        'aria-invalid': fout ? true : children.props['aria-invalid'],
      })
    : children;

  return (
    <div className={className}>
      <div className="flex items-center">
        <label htmlFor={id} className="veld-label mb-0">
          {label}
          {verplicht && (
            <>
              <span aria-hidden="true" className="verplicht">*</span>
              <span className="sr-only"> (verplicht)</span>
            </>
          )}
        </label>
        {info && <InfoTip label={`Uitleg bij ${typeof label === 'string' ? label.toLowerCase() : 'dit veld'}`}>{info}</InfoTip>}
      </div>
      <div className="mt-1">{invoer}</div>
      {hint && !fout && <p id={hintId} className="veld-hint">{hint}</p>}
      {hint && fout && <p id={hintId} className="sr-only">{hint}</p>}
      {fout && <p id={foutId} className="veld-fout" role="alert">{fout}</p>}
    </div>
  );
}
