import { initialen } from '@/lib/kms/leveranciers';

/** Logo van een leverancier in een vast kader, of de initialen als er geen logo is. */
export default function Logo({ naam, logo, grootte = 'h-11 w-20' }: { naam: string; logo: string | null; grootte?: string }) {
  if (logo) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded border border-line bg-white p-1 ${grootte}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={`Logo ${naam}`} className="max-h-full max-w-full object-contain" loading="lazy" />
      </span>
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center rounded border border-line bg-mist font-display text-[15px] font-bold tracking-wide text-ink-500 ${grootte}`} aria-hidden>
      {initialen(naam)}
    </span>
  );
}
