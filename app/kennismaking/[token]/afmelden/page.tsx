import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { isGeldigToken, prospectOpToken } from '@/lib/prospect/prospect';
import { site } from '@/content/site';
import { afmeldenActie } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Geen interesse',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
  referrer: 'same-origin',
};

/**
 * "Geen interesse?" Bewust een knop en geen directe link-actie: mailscanners en
 * link-previews openen links automatisch, en die mogen niemand afmelden.
 */
export default async function AfmeldenPagina({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ klaar?: string }>;
}) {
  const token = (await params).token.trim().toLowerCase();
  if (!isGeldigToken(token)) notFound();
  const { klaar } = await searchParams;

  const sb = kmsAdmin();
  const p = sb ? await prospectOpToken(sb, token).catch(() => null) : null;
  if (!p && !klaar) notFound();
  const afgemeld = Boolean(klaar) || Boolean(p?.afgemeld_op);

  return (
    <section className="container-lees sec">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        {afgemeld ? (
          <>
            <h1 className="kop-2">Helder, je hoort niets meer van ons</h1>
            <p className="mt-4 text-warm">
              Bedankt dat je het even liet weten. We hebben {p?.bedrijfsnaam ?? 'jullie bedrijf'} uit onze lijst gehaald en sturen geen brieven meer.
            </p>
            <p className="mt-4 text-warm">
              Toch een keer werkkleding nodig? Je bent altijd welkom: {site.phone} of {site.email}.
            </p>
            <Link href="/" className="btn-outline mt-6">Naar de website</Link>
          </>
        ) : (
          <>
            <h1 className="kop-2">Geen interesse?</h1>
            <p className="mt-4 text-warm">
              Geen probleem. Klik op de knop, dan halen we {p?.bedrijfsnaam ?? 'jullie bedrijf'} uit onze lijst en krijgen jullie geen brief of bericht meer van {site.name}.
            </p>
            <form action={afmeldenActie} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-secondary">Ja, meld ons af</button>
              <Link href={`/kennismaking/${token}`} prefetch={false} className="btn-outline">Toch nog even kijken</Link>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
