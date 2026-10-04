import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { inschrijvingStand } from '@/lib/nieuwsbrief/optin';
import AutoBevestig from './AutoBevestig';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Aanmelding bevestigen',
  robots: { index: false, follow: false },
};

export default async function BevestigenPage({ searchParams }: { searchParams: Promise<{ t?: string; klaar?: string; fout?: string }> }) {
  const { t = '', klaar, fout } = await searchParams;
  const stand = await inschrijvingStand(t);

  if (stand === 'bevestigd') {
    return (
      <>
        <PageHero
          eyebrow="Nieuwsbrief"
          title={klaar ? 'Gelukt, je staat op de lijst' : 'Je stond al op de lijst'}
          intro="Dank je wel. Je hoort van ons als er iets te melden is: een nieuwe collectie, een actie of handige tips over werkkleding. Afmelden kan onderaan elke mail."
        />
        <section className="container-x sec-sm">
          <Link href="/" className="btn-outline">Naar de website</Link>
        </section>
      </>
    );
  }

  if (stand === 'onbekend') {
    return (
      <>
        <PageHero
          eyebrow="Nieuwsbrief"
          title="Deze link werkt niet (meer)"
          intro="Misschien is de link niet helemaal goed overgekomen of is hij al vervangen door een nieuwere mail. Meld je gerust opnieuw aan."
        />
        <section className="container-x sec-sm">
          <Link href="/nieuwsbrief" className="btn-primary">Opnieuw aanmelden</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Nieuwsbrief" title="Nog één klik" intro="Bevestig dat je de nieuwsbrief van Frederiks Bedrijfskleding wilt ontvangen." />
      <section className="container-x sec-sm">
        {fout && <p className="mb-4 text-sm text-amber-800" role="alert">Dat lukte niet. Probeer het nog een keer.</p>}
        <AutoBevestig token={t} auto={!fout} />
      </section>
    </>
  );
}
