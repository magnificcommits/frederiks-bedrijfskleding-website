'use client';

import { useEffect, useState } from 'react';
import { logoPlek, meetFoto, type FotoVorm, type Soort } from '@/lib/fotoVorm';

/**
 * Een echte productfoto met het logo van de klant erop, op de plek waar het
 * geborduurd of bedrukt wordt. De foto wordt in de browser opgemeten (zie
 * lib/fotoVorm.ts); dat kost een paar milliseconden en het resultaat blijft per
 * foto bewaard zolang de pagina open is.
 *
 * De foto loopt via de eigen beeldserver (/_next/image). Dan komt hij van
 * hetzelfde domein en mag de browser de pixels lezen; rechtstreeks van een
 * leveranciers-CDN zou het canvas dat blokkeren.
 */

const metingen = new Map<string, Promise<FotoVorm | null>>();

const viaEigenServer = (src: string, w: number) =>
  src.startsWith('/') || src.startsWith('data:') ? src : `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

function meet(src: string, soort: Soort): Promise<FotoVorm | null> {
  const sleutel = `${soort}|${src}`;
  let p = metingen.get(sleutel);
  if (!p) {
    p = new Promise<FotoVorm | null>((klaar) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const schaal = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * schaal));
          const h = Math.max(1, Math.round(img.naturalHeight * schaal));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) return klaar(null);
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          klaar(meetFoto(data, w, h, soort));
        } catch {
          klaar(null);
        }
      };
      img.onerror = () => klaar(null);
      img.src = viaEigenServer(src, 256);
    });
    metingen.set(sleutel, p);
  }
  return p;
}

export function soortVoorType(type: string): Soort {
  if (type === 'werkbroek') return 'broek';
  if (type === 'bodywarmer') return 'mouwloos';
  return 'boven';
}

export function FotoMetLogo({
  src,
  type,
  positie,
  logo,
  techniek,
  alt = '',
  toonSchuin = false,
}: {
  src: string;
  type: string;
  positie: string;
  logo: string | null;
  techniek: string;
  alt?: string;
  /** Een korte opmerking tonen als de foto schuin is genomen. */
  toonSchuin?: boolean;
}) {
  const soort = soortVoorType(type);
  const [vorm, setVorm] = useState<{ src: string; v: FotoVorm | null } | null>(null);

  useEffect(() => {
    let weg = false;
    meet(src, soort).then((v) => { if (!weg) setVorm({ src, v }); });
    return () => { weg = true; };
  }, [src, soort]);

  const v = vorm?.src === src ? vorm.v : null;
  const plek = v ? logoPlek(v, positie) : null;

  // De foto staat met object-contain in een vierkant. Reken de plek op de foto om
  // naar het vierkant: bij een staande foto blijft er links en rechts ruimte over.
  let stijl: React.CSSProperties | null = null;
  if (v && plek) {
    const a = v.breedte / v.hoogte;
    const bw = a >= 1 ? 1 : a;
    const bh = a >= 1 ? 1 / a : 1;
    const ox = (1 - bw) / 2;
    const oy = (1 - bh) / 2;
    const breedte = plek.breedte * bw;
    stijl = {
      left: `${(ox + plek.x * bw) * 100}%`,
      top: `${(oy + plek.y * bh) * 100}%`,
      width: `${breedte * 100}%`,
      height: `${breedte * 80}%`,
    };
  }

  return (
    <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={viaEigenServer(src, 640)} alt={alt} className="absolute inset-0 h-full w-full object-contain" />
      {logo && stijl && (
        <span className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={stijl}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="Je logo"
            className="max-h-full max-w-full object-contain"
            style={{ filter: techniek === 'borduren' ? 'contrast(1.05) saturate(0.95)' : undefined }}
          />
        </span>
      )}
      {toonSchuin && v && v.symmetrie < (soort === 'broek' ? 0.6 : 0.8) && (
        <span className="absolute inset-x-2 bottom-2 rounded bg-white/90 px-2 py-1 text-center text-[11px] text-warm">
          Schuin gefotografeerd. De exacte plek zie je op de drukproef.
        </span>
      )}
    </div>
  );
}

/** Meting van een foto als hook, voor onderdelen die alleen de kleur of vorm nodig hebben. */
export function useFotoVorm(src: string | null | undefined, type: string): FotoVorm | null {
  const soort = soortVoorType(type);
  const [vorm, setVorm] = useState<{ src: string; v: FotoVorm | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let weg = false;
    meet(src, soort).then((v) => { if (!weg) setVorm({ src, v }); });
    return () => { weg = true; };
  }, [src, soort]);
  return src && vorm?.src === src ? vorm.v : null;
}

/** Is een kleur licht genoeg om er donkere lijnen op te tekenen? */
export function isLicht(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
}

function laadBeeld(src: string): Promise<HTMLImageElement | null> {
  return new Promise((klaar) => {
    const img = new Image();
    img.onload = () => klaar(img);
    img.onerror = () => klaar(null);
    img.src = src;
  });
}

/**
 * Tekent een kledingstuk met logo op een wit vierkant canvas en geeft een PNG
 * terug, voor de PDF en de mail. Met foto (voorkant): de echte foto met het logo
 * op de gemeten plek. Anders tekent de aanroeper de schets zelf.
 */
export async function tekenFotoMetLogo(opts: { foto: string; type: string; positie: string; logo: string | null; maat?: number }): Promise<string | null> {
  const maat = opts.maat ?? 640;
  const [img, logoImg, v] = await Promise.all([
    laadBeeld(viaEigenServer(opts.foto, 640)),
    opts.logo ? laadBeeld(opts.logo) : Promise.resolve(null),
    meet(opts.foto, soortVoorType(opts.type)),
  ]);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = maat;
  c.height = maat;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maat, maat);
  const a = img.naturalWidth / img.naturalHeight;
  const bw = a >= 1 ? maat : maat * a;
  const bh = a >= 1 ? maat / a : maat;
  const ox = (maat - bw) / 2;
  const oy = (maat - bh) / 2;
  ctx.drawImage(img, ox, oy, bw, bh);
  const plek = v ? logoPlek(v, opts.positie) : null;
  if (logoImg && plek) {
    const vakB = plek.breedte * bw;
    const vakH = vakB * 0.8;
    const s = Math.min(vakB / logoImg.naturalWidth, vakH / logoImg.naturalHeight);
    const lw = logoImg.naturalWidth * s;
    const lh = logoImg.naturalHeight * s;
    ctx.drawImage(logoImg, ox + plek.x * bw - lw / 2, oy + plek.y * bh - lh / 2, lw, lh);
  }
  return c.toDataURL('image/jpeg', 0.9);
}
