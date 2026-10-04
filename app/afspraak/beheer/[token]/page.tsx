import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getAfspraakOpToken, nogTeWijzigen } from '@/lib/afspraken/afspraken';
import { SOORT_INFO, STATUS_LABEL } from '@/lib/afspraken/soorten';
import { momentTekst } from '@/lib/afspraken/mails';
import { nlDelen } from '@/app/dashboard/taken/tijd';
import { site } from '@/content/site';
import BeheerAfspraak from './BeheerAfspraak';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Je afspraak',
  robots: { index: false, follow: false },
};

export default async function AfspraakBeheerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getAfspraakOpToken(token);

  if (!a) {
    return (
      <>
        <PageHero eyebrow="Afspraak" title="Deze afspraak kunnen we niet vinden" intro="De link is misschien niet helemaal goed overgekomen. Bel of app ons gerust, dan kijken we het even na." />
        <section className="container-x sec-sm">
          <p className="text-warm">
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-ink-900">{site.phone}</a> ·{' '}
            <Link href="/afspraak" className="text-amber-700 underline">Nieuwe afspraak maken</Link>
          </p>
        </section>
      </>
    );
  }

  const info = SOORT_INFO[a.soort];
  const start = new Date(a.start_op);
  const wijzigbaar = nogTeWijzigen(a);

  return (
    <>
      <PageHero eyebrow="Je afspraak" title={`${info.label} op ${momentTekst(start)}`} />
      <section className="container-x sec-md">
        <div className="mx-auto max-w-[56rem] space-y-6">
          <div className="card">
            <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="font-semibold text-ink-900">Status</dt>
              <dd className="text-warm">{STATUS_LABEL[a.status]}</dd>
              <dt className="font-semibold text-ink-900">Wanneer</dt>
              <dd className="text-warm">
                {momentTekst(start)} tot {nlDelen(new Date(a.eind_op)).tijd}
              </dd>
              <dt className="font-semibold text-ink-900">Waar</dt>
              <dd className="text-warm">{a.locatie ?? '-'}</dd>
              <dt className="font-semibold text-ink-900">Naam</dt>
              <dd className="text-warm">
                {a.naam}
                {a.bedrijf ? `, ${a.bedrijf}` : ''}
              </dd>
            </dl>
          </div>

          {wijzigbaar ? (
            <BeheerAfspraak token={a.token} />
          ) : (
            <p className="text-warm">
              {a.status === 'geannuleerd'
                ? 'Deze afspraak is geannuleerd.'
                : 'Deze afspraak is al geweest of loopt nu, dus online wijzigen kan niet meer.'}{' '}
              Wil je iets regelen? Bel of app{' '}
              <a href={`tel:${site.phoneIntl}`} className="font-semibold text-ink-900">{site.phone}</a> of{' '}
              <Link href="/afspraak" className="text-amber-700 underline">maak een nieuwe afspraak</Link>.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
