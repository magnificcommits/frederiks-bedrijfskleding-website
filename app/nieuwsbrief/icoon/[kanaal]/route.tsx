import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

/**
 * Social-iconen voor in de nieuwsbrief, als PNG (SVG wordt door Gmail en
 * Outlook niet getoond). Een gevulde cirkel in de gekozen kleur met een wit
 * (of bij een lichte kleur: donker) symbool. Gebruik:
 *   /nieuwsbrief/icoon/facebook?kleur=ec6726
 * Wordt 96x96 geleverd en in de mail op 32x32 getoond, dus scherp op retina.
 */

const KANALEN = ['facebook', 'instagram', 'linkedin', 'whatsapp', 'email'] as const;
type Kanaal = (typeof KANALEN)[number];

function hex(v: string | null): string {
  const s = (v ?? '').replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  return '#1c1c1c';
}

/** Licht of donker symbool, afhankelijk van de helderheid van de cirkel. */
function symboolKleur(achtergrond: string): string {
  const r = parseInt(achtergrond.slice(1, 3), 16);
  const g = parseInt(achtergrond.slice(3, 5), 16);
  const b = parseInt(achtergrond.slice(5, 7), 16);
  const helderheid = (r * 299 + g * 587 + b * 114) / 1000;
  return helderheid > 180 ? '#1c1c1c' : '#ffffff';
}

function Symbool({ kanaal, kleur }: { kanaal: Kanaal; kleur: string }) {
  switch (kanaal) {
    case 'facebook':
      return (
        <svg width="56" height="56" viewBox="0 0 24 24">
          <path
            fill={kleur}
            d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21z"
          />
        </svg>
      );
    case 'instagram':
      return (
        <svg width="56" height="56" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke={kleur} strokeWidth="1.9" />
          <circle cx="12" cy="12" r="3.8" fill="none" stroke={kleur} strokeWidth="1.9" />
          <circle cx="16.6" cy="7.4" r="1.1" fill={kleur} />
        </svg>
      );
    case 'linkedin':
      return (
        <svg width="56" height="56" viewBox="0 0 24 24">
          <rect x="4.6" y="9.4" width="3.1" height="10" fill={kleur} />
          <circle cx="6.15" cy="6.1" r="1.8" fill={kleur} />
          <path
            fill={kleur}
            d="M10.2 9.4h3v1.4c.4-.8 1.5-1.6 3.1-1.6 3.2 0 3.8 2.1 3.8 4.8v5.4H17v-4.8c0-1.1 0-2.6-1.6-2.6s-1.9 1.3-1.9 2.5v4.9h-3.3z"
          />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg width="56" height="56" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke={kleur}
            strokeWidth="1.7"
            strokeLinejoin="round"
            d="M12 3.6a8.4 8.4 0 0 0-7.2 12.7L3.7 20.3l4.1-1.1A8.4 8.4 0 1 0 12 3.6z"
          />
          <path
            fill={kleur}
            d="M9.3 8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .6.4l.8 1.9c.1.2 0 .4-.1.6l-.5.6c-.1.2-.2.3 0 .6.3.5 1.4 2 3.1 2.7.3.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.4 0 .4-.1 1.2-.6 1.6-.5.5-1.5.8-2.5.6-1-.2-2.3-.7-3.8-2-1.6-1.4-2.5-3.1-2.7-3.9-.3-1 .1-1.9.4-2.5z"
          />
        </svg>
      );
    case 'email':
      return (
        <svg width="56" height="56" viewBox="0 0 24 24">
          <rect x="3.8" y="6" width="16.4" height="12" rx="1.6" fill="none" stroke={kleur} strokeWidth="1.8" />
          <path d="M4.5 7l7.5 6 7.5-6" fill="none" stroke={kleur} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ kanaal: string }> }) {
  const { kanaal } = await params;
  const naam = kanaal.replace(/\.png$/, '') as Kanaal;
  if (!KANALEN.includes(naam)) return new Response('Onbekend icoon', { status: 404 });

  const achtergrond = hex(new URL(req.url).searchParams.get('kleur'));
  const symbool = symboolKleur(achtergrond);

  return new ImageResponse(
    (
      <div
        style={{
          width: '96px',
          height: '96px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '48px',
          backgroundColor: achtergrond,
        }}
      >
        <Symbool kanaal={naam} kleur={symbool} />
      </div>
    ),
    {
      width: 96,
      height: 96,
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  );
}
