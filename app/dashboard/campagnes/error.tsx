'use client';
import FoutStaat from '@/components/dashboard/ui/FoutStaat';

export default function Fout({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <FoutStaat error={error} reset={reset} terugHref="/dashboard/campagnes" terugLabel="Naar campagnes" />;
}
