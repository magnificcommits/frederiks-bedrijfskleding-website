import React from 'react';

function adjust(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Geeft de stijl voor het logo-overlay per kledingstuk en positie (in % van de preview). */
export function logoBoxStyle(type: string, pos: string): React.CSSProperties {
  if (type === 'werkbroek') {
    const m: Record<string, React.CSSProperties> = {
      'borst-links': { left: '30%', top: '40%', width: '15%' },
      'borst-rechts': { left: '55%', top: '40%', width: '15%' },
      'rug': { left: '38%', top: '30%', width: '24%' },
    };
    return { position: 'absolute', ...m[pos] };
  }
  const m: Record<string, React.CSSProperties> = {
    'borst-links': { left: '37%', top: '33%', width: '15%' },
    'borst-rechts': { left: '49%', top: '33%', width: '15%' },
    'rug': { left: '34%', top: '42%', width: '32%' },
  };
  return { position: 'absolute', ...m[pos] };
}

export function Garment({ type, color, light }: { type: string; color: string; light?: boolean }) {
  const shade = adjust(color, light ? -22 : -34);
  const hi = adjust(color, light ? 10 : 26);
  const seam = light ? '#cfcdc9' : adjust(color, -55);
  const gid = 'gradient-garment';
  const S = (extra: React.SVGAttributes<SVGElement> = {}): React.SVGAttributes<SVGElement> => ({ stroke: seam, strokeWidth: 1.4, fill: 'none', strokeLinejoin: 'round', strokeLinecap: 'round', ...extra });

  let body: React.ReactNode = null;

  if (type === 'tshirt') {
    body = (<>
      <path d="M86 42 C100 58 140 58 154 42 L196 58 L222 100 L196 118 L182 98 L182 232 C150 242 90 242 58 232 L58 98 L44 118 L18 100 L44 58 Z" fill={`url(#${gid})`} stroke={seam} strokeWidth="1.6" strokeLinejoin="round" />
      <path {...S({ d: 'M92 47 C104 61 136 61 148 47' })} />
      <path {...S({ d: 'M196 118 L186 113' })} /><path {...S({ d: 'M44 118 L54 113' })} />
      <path d="M58 98 L58 232 C76 237 76 237 86 238 L86 100 Z" fill={shade} opacity="0.18" />
    </>);
  } else if (type === 'polo') {
    body = (<>
      <path d="M86 44 L110 40 L120 56 L130 40 L154 44 L196 58 L222 100 L196 118 L182 98 L182 232 C150 242 90 242 58 232 L58 98 L44 118 L18 100 L44 58 Z" fill={`url(#${gid})`} stroke={seam} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M110 40 L120 56 L96 56 Z" fill={shade} opacity="0.5" stroke={seam} strokeWidth="1.2" />
      <path d="M130 40 L120 56 L144 56 Z" fill={shade} opacity="0.5" stroke={seam} strokeWidth="1.2" />
      <rect x="113" y="56" width="14" height="40" rx="2" fill={hi} opacity="0.35" stroke={seam} strokeWidth="1.2" />
      <circle cx="120" cy="66" r="2.4" fill={seam} /><circle cx="120" cy="84" r="2.4" fill={seam} />
      <path {...S({ d: 'M196 118 L186 113' })} /><path {...S({ d: 'M44 118 L54 113' })} />
    </>);
  } else if (type === 'sweater') {
    body = (<>
      <path d="M86 42 C100 58 140 58 154 42 L196 58 L228 96 L212 214 L180 218 L178 108 L178 232 C150 242 90 242 58 232 L62 108 L60 218 L28 214 L12 96 L44 58 Z" fill={`url(#${gid})`} stroke={seam} strokeWidth="1.6" strokeLinejoin="round" />
      <path {...S({ d: 'M92 47 C104 61 136 61 148 47' })} />
      <path {...S({ d: 'M180 206 L212 202' })} /><path {...S({ d: 'M60 206 L28 202' })} />
      <path {...S({ d: 'M58 224 C90 234 150 234 182 224' })} />
    </>);
  } else if (type === 'softshell' || type === 'winterjas') {
    body = (<>
      <path d="M84 40 L156 40 L196 58 L228 96 L212 214 L180 218 L178 108 L178 234 L62 234 L62 108 L60 218 L28 214 L12 96 L44 58 Z" fill={`url(#${gid})`} stroke={seam} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M84 40 L120 50 L156 40 L154 56 L120 64 L86 56 Z" fill={shade} opacity="0.55" stroke={seam} strokeWidth="1.2" />
      <line x1="120" y1="64" x2="120" y2="234" stroke={seam} strokeWidth="2.2" />
      <rect x="116" y="60" width="8" height="10" rx="2" fill={seam} />
      <rect x="132" y="120" width="30" height="22" rx="2" {...S({})} />
      {type === 'winterjas' && [96, 124, 152, 180, 208].map((y) => (
        <line key={y} x1="64" y1={y} x2="176" y2={y} stroke={seam} strokeWidth="1" opacity="0.5" />
      ))}
      <path {...S({ d: 'M180 206 L212 202' })} /><path {...S({ d: 'M60 206 L28 202' })} />
    </>);
  } else if (type === 'bodywarmer') {
    body = (<>
      <path d="M84 40 L156 40 C176 52 182 74 178 96 L178 234 L62 234 L62 96 C58 74 64 52 84 40 Z" fill={`url(#${gid})`} stroke={seam} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M84 40 L120 50 L156 40 L154 56 L120 64 L86 56 Z" fill={shade} opacity="0.55" stroke={seam} strokeWidth="1.2" />
      <line x1="120" y1="64" x2="120" y2="234" stroke={seam} strokeWidth="2.2" />
      <rect x="116" y="60" width="8" height="10" rx="2" fill={seam} />
      {[92, 120, 148, 176, 204].map((y) => (
        <line key={y} x1="64" y1={y} x2="176" y2={y} stroke={seam} strokeWidth="1" opacity="0.45" />
      ))}
    </>);
  } else { // werkbroek
    body = (<>
      <path d="M62 40 L178 40 L178 64 L172 236 L130 236 L120 128 L110 236 L68 236 L62 64 Z" fill={`url(#${gid})`} stroke={seam} strokeWidth="1.6" strokeLinejoin="round" />
      <line x1="62" y1="62" x2="178" y2="62" stroke={seam} strokeWidth="1.6" />
      <rect x="74" y="70" width="20" height="16" rx="2" {...S({})} />
      <rect x="146" y="70" width="20" height="16" rx="2" {...S({})} />
      <rect x="78" y="120" width="26" height="30" rx="2" {...S({})} />
      <rect x="136" y="120" width="26" height="30" rx="2" {...S({})} />
      <line x1="120" y1="64" x2="120" y2="128" stroke={seam} strokeWidth="1" opacity="0.5" />
    </>);
  }

  return (
    <svg viewBox="0 0 240 260" className="h-full w-full" role="img" aria-label="Voorbeeld kledingstuk">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hi} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={shade} />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
}
