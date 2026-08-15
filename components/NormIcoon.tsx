/**
 * Pictogrammen per normsoort.
 *
 * Getekend in SVG en niet als foto: een norm is een symbool, geen product.
 * Het maakt de pagina's herkenbaar en scanbaar zonder dat er ook maar één
 * fotoshoot voor nodig is — precies wat we nu missen.
 *
 * De vormen leunen op de officiele pictogrammen (hesje, vlam, druppel,
 * sneeuwvlok, vlamboog, schoen) zonder ze exact na te maken; we suggereren
 * geen certificering die we niet kunnen aantonen.
 */
export type NormSoort = 'zichtbaarheid' | 'hitte-en-vlam' | 'weer' | 'schoenen' | 'overig';

const paden: Record<NormSoort, React.ReactNode> = {
  zichtbaarheid: (
    <>
      <path d="M18 16h12l6 6v22H12V22z" />
      <path d="M18 16v8h12v-8" />
      <path d="M12 30h24M12 36h24" strokeDasharray="4 3" />
    </>
  ),
  'hitte-en-vlam': (
    <>
      <path d="M24 8c2 7-4 9-4 15a8 8 0 0 0 16 0c0-8-6-10-12-15z" />
      <path d="M24 30c1 3-2 4-2 6a4 4 0 0 0 8 0c0-3-3-4-6-6z" />
      <path d="M14 40h20" />
    </>
  ),
  weer: (
    <>
      <path d="M24 8c5 8 9 12 9 17a9 9 0 0 1-18 0c0-5 4-9 9-17z" />
      <path d="M19 26a5 5 0 0 0 3 5" />
      <path d="M14 40h4M22 40h4M30 40h4" />
    </>
  ),
  schoenen: (
    <>
      <path d="M8 32V18h9l5 6 8 3c4 1 6 3 6 6v5H8z" />
      <path d="M8 32h28" />
      <path d="M17 18v6" />
      <path d="M8 38h30" strokeDasharray="3 3" />
    </>
  ),
  overig: (
    <>
      <path d="M26 6 12 26h10l-2 16 14-20H24z" />
      <path d="M8 40h6M34 40h6" />
    </>
  ),
};

export function NormIcoon({
  soort,
  className = 'h-12 w-12',
}: {
  soort: NormSoort;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paden[soort] ?? paden.overig}
    </svg>
  );
}
