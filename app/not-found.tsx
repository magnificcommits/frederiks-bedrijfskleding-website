import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-bold">Pagina niet gevonden</h1>
      <p className="mt-3 max-w-md text-warm">Deze pagina bestaat niet (meer). Ga terug naar de homepage of vraag direct advies aan.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-outline">Naar home</Link>
        <Link href="/offerte" className="btn-primary">Vraag advies aan</Link>
      </div>
    </section>
  );
}
