export function Faq({ items, title = 'Veelgestelde vragen' }: { items: { q: string; a: string }[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="container-x py-16 sm:py-20">
      <h2 className="text-3xl font-bold">{title}</h2>
      <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
        {items.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-800">
              {f.q}
              <span className="text-amber-500 transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 text-warm">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
