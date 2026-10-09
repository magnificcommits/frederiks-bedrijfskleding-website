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

/**
 * Vaste maten voor foto's die we vaak tonen en waar de meting misgaat. De witte
 * Snickers-polo (voorbeeld bij de logostap) staat op een grijze achtergrond met
 * een lichte vlek in het midden; de schaduwkant van het shirt loopt daar in over
 * en dan komt het logo te dicht bij de knoopsluiting. Met de hand opgemeten.
 */
const VASTE_VORMEN: { herken: RegExp; vorm: FotoVorm }[] = [
  {
    herken: /2718-0900\.jpg/i,
    vorm: { breedte: 256, hoogte: 256, romp: { midden: 0.51, breedte: 0.45, schouder: 0.17, onder: 0.86 }, pijpen: null, symmetrie: 0.95, kleur: '#f2f2f2' },
  },
];

const viaEigenServer = (src: string, w: number) =>
  src.startsWith('/') || src.startsWith('data:') ? src : `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

/**
 * Beeld ophalen voor de meting. Via fetch en niet via een <img>: een <img> krijgt
 * van de beeldserver AVIF, en die compressie vervaagt de randen van witte
 * kleding op een lichte achtergrond zo sterk dat de meting ze mist.
 */
async function laadPixels(src: string): Promise<{ data: Uint8ClampedArray; w: number; h: number } | null> {
  try {
    const r = await fetch(viaEigenServer(src, 256), { headers: { Accept: 'image/jpeg,image/png;q=0.9,*/*;q=0.5' } });
    if (!r.ok) return null;
    const bm = await createImageBitmap(await r.blob());
    const schaal = Math.min(1, 256 / Math.max(bm.width, bm.height));
    const w = Math.max(1, Math.round(bm.width * schaal));
    const h = Math.max(1, Math.round(bm.height * schaal));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bm, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, w, h };
  } catch {
    return null;
  }
}

function meet(src: string, soort: Soort): Promise<FotoVorm | null> {
  const sleutel = `${soort}|${src}`;
  let p = metingen.get(sleutel);
  const vast = soort === 'boven' ? VASTE_VORMEN.find((v) => v.herken.test(src)) : undefined;
  if (!p && vast) {
    p = Promise.resolve(vast.vorm);
    metingen.set(sleutel, p);
  }
  if (!p) {
    p = laadPixels(src).then((px) => (px ? meetFoto(px.data, px.w, px.h, soort) : null)).catch(() => null);
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
