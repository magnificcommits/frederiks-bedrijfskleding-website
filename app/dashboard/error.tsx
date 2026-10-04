'use client';
import FoutStaat from '@/components/dashboard/ui/FoutStaat';

/** Vangt fouten in elk dashboardscherm op; de zijbalk blijft staan, dus je kunt altijd verder. */
export default function Fout({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <FoutStaat error={error} reset={reset} />;
}
