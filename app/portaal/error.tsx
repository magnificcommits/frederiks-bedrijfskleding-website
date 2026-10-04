'use client';
import FoutStaat from '@/components/dashboard/ui/FoutStaat';
import { useVertaler } from '@/lib/i18n/portaal/client';

/** Foutscherm voor het portaal, in de taal van de gebruiker en met een weg terug naar het overzicht. */
export default function Fout({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useVertaler();
  return (
    <FoutStaat
      error={error}
      reset={reset}
      breedte="container-x"
      titel={t('algemeen.foutTitel')}
      tekst={t('algemeen.foutTekst')}
      offlineTekst={t('algemeen.foutOffline')}
      opnieuwLabel={t('algemeen.opnieuwProberen')}
      terugHref="/portaal"
      terugLabel={t('algemeen.terugNaarOverzicht')}
      codeLabel={t('algemeen.foutCode')}
    />
  );
}
