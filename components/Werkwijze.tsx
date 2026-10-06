import { werkwijze } from '@/content/werkwijze';

/**
 * De vier stappen van eerste gesprek tot nabestelling, als één rij met een
 * gestikte lijn ertussen. Eén component, zodat de stappen op elke pagina
 * hetzelfde ogen. `children` komt onder de stappen (toelichting of knoppen).
 */
export function Werkwijze({
  titel = 'Van eerste gesprek tot nabestelling',
  vlak = 'mist',
  children,
}: {
  titel?: string;
  vlak?: 'mist' | 'wit';
  children?: React.ReactNode;
}) {
  return (
    <section className={vlak === 'mist' ? 'border-y border-line bg-mist' : 'bg-white'}>
      <div className="container-x sec-md">
        <h2 className="kop-2">{titel}</h2>
        <ol className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {werkwijze.map((s, i) => (
            <li key={s.nr} className="relative">
              {i < werkwijze.length - 1 && <span className="absolute left-12 right-0 top-4 hidden border-t-2 border-dashed border-amber-400 lg:block" aria-hidden="true" />}
              <span className="stap-nr relative" data-stand="nu" aria-hidden="true">{i + 1}</span>
              <h3 className="mt-3 font-display text-[1.0625rem] font-extrabold text-ink-900">{s.title}</h3>
              <p className="mt-1 text-sm leading-snug text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
        {children}
      </div>
    </section>
  );
}
