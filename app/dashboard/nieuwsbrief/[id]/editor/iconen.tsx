/** Kleine lijn-iconen voor de editor (inline SVG, geen bibliotheek). */
import type { ReactNode } from 'react';

function Svg({ children, className = 'h-4 w-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

type P = { className?: string };

export const IcoonOngedaan = (p: P) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);
export const IcoonOpnieuw = (p: P) => (
  <Svg {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Svg>
);
export const IcoonOog = (p: P) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IcoonPijlOmhoog = (p: P) => (
  <Svg {...p}>
    <path d="m18 15-6-6-6 6" />
  </Svg>
);
export const IcoonPijlOmlaag = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const IcoonPijlLinks = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Svg>
);
export const IcoonKopie = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
);
export const IcoonPrullenbak = (p: P) => (
  <Svg {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </Svg>
);
export const IcoonGreep = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </Svg>
);
export const IcoonMeer = (p: P) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="19" cy="12" r="1.2" />
  </Svg>
);
export const IcoonBewaar = (p: P) => (
  <Svg {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </Svg>
);
export const IcoonChevron = ({ open, className = 'h-4 w-4' }: P & { open: boolean }) => (
  <Svg className={`${className} transition-transform ${open ? 'rotate-90' : ''}`}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);
export const IcoonComputer = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
);
export const IcoonTelefoon = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </Svg>
);
export const IcoonNiets = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Svg>
);
export const IcoonLinks = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h10M4 18h14" />
  </Svg>
);
export const IcoonMidden = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M5 18h14" />
  </Svg>
);
export const IcoonRechts = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16M10 12h10M6 18h14" />
  </Svg>
);
export const IcoonLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Svg>
);
export const IcoonLijst = (p: P) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </Svg>
);
export const IcoonGenummerd = (p: P) => (
  <Svg {...p}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5h1v4M4 9h2M4 15h2l-2 3h2" />
  </Svg>
);
export const IcoonPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IcoonMin = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

/** Kleine plaatjes voor de blokkenlijst. */
export function BlokIcoon({ type, className = 'h-6 w-6' }: { type: string; className?: string }) {
  switch (type) {
    case 'tekst':
      return (
        <Svg className={className}>
          <path d="M4 7V5h16v2M9 19h6M12 5v14" />
        </Svg>
      );
    case 'kop':
      return (
        <Svg className={className}>
          <path d="M6 4v16M18 4v16M6 12h12" />
        </Svg>
      );
    case 'afbeelding':
      return (
        <Svg className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m21 16-5-5-9 9" />
        </Svg>
      );
    case 'knop':
      return (
        <Svg className={className}>
          <rect x="3" y="8" width="18" height="8" rx="3" />
          <path d="M8 12h8" />
        </Svg>
      );
    case 'product':
      return (
        <Svg className={className}>
          <path d="M8 3 4 6v4l3-1v12h10V9l3 1V6l-4-3c-1 2-2 3-4 3S9 5 8 3Z" />
        </Svg>
      );
    case 'scheiding':
      return (
        <Svg className={className}>
          <path d="M3 12h18" />
          <path d="M8 6h8M8 18h8" strokeOpacity={0.35} />
        </Svg>
      );
    case 'ruimte':
      return (
        <Svg className={className}>
          <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
        </Svg>
      );
    case 'social':
      return (
        <Svg className={className}>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
        </Svg>
      );
    case 'webversie':
      return (
        <Svg className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </Svg>
      );
    case 'afmelden':
      return (
        <Svg className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
          <path d="m15 15 4 4M19 15l-4 4" />
        </Svg>
      );
    default:
      return (
        <Svg className={className}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </Svg>
      );
  }
}

/** Klein plaatje van een kolomindeling, bv. [33, 67]. */
export function StructuurPlaatje({ verhouding }: { verhouding: number[] }) {
  return (
    <span className="flex h-7 w-full gap-1" aria-hidden="true">
      {verhouding.map((v, i) => (
        <span key={i} className="rounded-sm border border-blue-300 bg-blue-50" style={{ flexGrow: v, flexBasis: 0 }} />
      ))}
    </span>
  );
}
