import { reviews } from '@/content/reviews';
import { site } from '@/content/site';
import { Stars } from '@/components/Stars';

export function Reviews({ limit }: { limit?: number }) {
  const list = limit ? reviews.slice(0, limit) : reviews;
  return (
    <section className="bg-ink-900 text-white">
      <div className="container-x py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-amber-400">Referenties</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Wat klanten over ons zeggen</h2>
          </div>
          {site.rating.count > 0 && (
            <div className="flex items-center gap-2 text-sm text-ink-200">
              <Stars value={Math.round(site.rating.value)} />
              <span>Beoordeeld met een <strong className="text-white">{site.rating.value.toFixed(1)}</strong> uit 5</span>
            </div>
          )}
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <figure key={r.author} className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-6">
              <Stars value={r.rating} />
              <blockquote className="mt-3 grow text-sm leading-relaxed text-ink-100">“{r.text}”</blockquote>
              <figcaption className="mt-4 text-sm font-bold text-white">{r.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
