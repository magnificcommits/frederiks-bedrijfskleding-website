export function PageHero({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <section className="border-b border-line bg-mist">
      <div className="container-x py-14 sm:py-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-bold text-balance sm:text-4xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-warm">{intro}</p>}
      </div>
    </section>
  );
}
