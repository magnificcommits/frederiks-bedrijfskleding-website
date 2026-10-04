/** Laadstaat binnen de sparen-layout (die heeft de kop en tabs al). */
export default function Laden() {
  return (
    <div className="mt-5 space-y-3" aria-busy="true">
      <p role="status" className="sr-only">Bezig met laden</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden="true" className="skelet block h-20 rounded-lg" />
        ))}
      </div>
      <span aria-hidden="true" className="skelet block h-64 rounded-lg" />
    </div>
  );
}
