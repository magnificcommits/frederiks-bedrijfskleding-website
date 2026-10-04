/* ---------------------------------------------------------------------------
 * Een lijnicoon per vakgebied.
 *
 * Foto's zijn er nog niet, dus het onderscheid tussen de tien kaartjes moet uit
 * de tekening komen. Simpele vormen van 24x24 in currentColor: een blad, een
 * helm, een verfroller. Onbekende slug valt terug op een neutraal icoon.
 * ------------------------------------------------------------------------- */
const vakPaden: Record<string, React.ReactNode> = {
  'hoveniers-en-groenvoorziening': (
    <>
      <path d="M20 4c-9 0-15 4-15 11 0 2 .6 3.6 1.4 4.8C9 16 13 12.5 18 10.5c-4 3-7.5 6.5-9.6 10.4 1 .5 2.2.8 3.3.8 5.5 0 8.3-6 8.3-17.7z" />
      <path d="M4 21c1.5-3.5 3.6-6.4 6-8.6" />
    </>
  ),
  'bouw-en-aannemers': (
    <>
      <path d="M3 18h18" />
      <path d="M5 18v-3a7 7 0 0 1 14 0v3" />
      <path d="M10 4.6V9M14 4.6V9" />
      <path d="M9.5 4h5" />
    </>
  ),
  'schilders-en-afbouw': (
    <>
      <rect x="3" y="4" width="11" height="5" rx="1" />
      <path d="M14 6.5h5v4h-6v2.5" />
      <rect x="10.5" y="13" width="5" height="8" rx="1.2" />
    </>
  ),
  'installatie-en-techniek': (
    <>
      <path d="M13 2 4 13.5h6.5L10 22l9-11.5h-6.5z" />
    </>
  ),
  'metaal-en-industrie': (
    <>
      <path d="M12 3c1.6 4.3-2.6 5.4-2.6 8.9a4.6 4.6 0 0 0 9.2 0c0-2.2-1.5-3.9-3.2-5.4" />
      <path d="M6 6 4 4M6 12H3M7 17l-2 2" />
      <path d="M9 21h9" />
    </>
  ),
  'transport-en-logistiek': (
    <>
      <path d="M2 6h12v10H2z" />
      <path d="M14 9.5h4l3 3.2V16h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  'agrarisch-en-loonwerk': (
    <>
      <path d="M12 21V8" />
      <path d="M12 8c0-2.5 1.6-4.5 4-5 0 2.6-1.7 4.6-4 5z" />
      <path d="M12 8c0-2.5-1.6-4.5-4-5 0 2.6 1.7 4.6 4 5z" />
      <path d="M12 14c0-2.2 1.5-3.9 3.6-4.4 0 2.3-1.5 4-3.6 4.4z" />
      <path d="M12 14c0-2.2-1.5-3.9-3.6-4.4 0 2.3 1.5 4 3.6 4.4z" />
    </>
  ),
  'horeca-en-food': (
    <>
      <path d="M7.5 16.5V21h9v-4.5" />
      <path d="M7.5 17a4 4 0 0 1-1.2-7.8 4 4 0 0 1 6-4.2 4 4 0 0 1 6 4.2A4 4 0 0 1 16.5 17z" />
      <path d="M7.5 19h9" />
    </>
  ),
  'zorg-en-welzijn': (
    <>
      <path d="M12 20.5S4.5 16 4.5 10.5A4 4 0 0 1 12 8.3a4 4 0 0 1 7.5 2.2c0 5.5-7.5 10-7.5 10z" />
      <path d="M12 10v4M10 12h4" />
    </>
  ),
  'kantoor-en-receptie': (
    <>
      <path d="M9 3.5 12 6l3-2.5 5 2v6h-3v9H7v-9H4v-6z" />
      <path d="M12 6.5 10.7 9l1.3 5.5L13.3 9z" />
    </>
  ),
};

const neutraalPad = (
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M9 10v9.5" />
  </>
);

export function VakIcoon({ slug }: { slug: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {vakPaden[slug] ?? neutraalPad}
    </svg>
  );
}
