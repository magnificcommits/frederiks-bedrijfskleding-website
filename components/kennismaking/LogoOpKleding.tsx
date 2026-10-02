import type { LogoPositie } from '@/lib/prospect/types';

/**
 * Artikelfoto met het logo van de prospect erop (of de bedrijfsnaam als tekst als er geen logo is).
 * Pure presentatie, server- en clientcomponent-veilig. Signatuur blijft gelijk: ook het
 * voorbeeldportaal gebruikt dit component.
 *
 * - De tekstmaat schaalt met de breedte van het kader (container query units), niet
 *   met het scherm. Zo klopt hij in een kleine kaart, een grote galerij en op papier.
 * - Een heel subtiele lichte rand om het logo houdt een donker logo leesbaar op een
 *   donkere jas, zonder dat het er als sticker op komt te zitten.
 * - Logo-url's komen uit onze eigen opslag; no-referrer voorkomt dat we bij een
 *   externe url de token-link van de prospect lekken.
 */
export default function LogoOpKleding({
  fotoUrl,
  alt,
  logoUrl,
  bedrijfsnaam,
  positie,
  className,
}: {
  fotoUrl: string;
  alt: string;
  logoUrl: string | null;
  bedrijfsnaam: string;
  positie: LogoPositie;
  className?: string;
}) {
  const breedte = Math.max(4, Math.min(60, positie.breedte));
  const stijl = {
    left: `${positie.x}%`,
    top: `${positie.y}%`,
    width: `${breedte}%`,
    transform: 'translate(-50%, -50%)',
  } as const;

  // Lettergrootte zo kiezen dat de naam ongeveer de logobreedte vult, met een
  // plafond zodat een korte naam geen schreeuwende kop wordt.
  const naam = bedrijfsnaam.trim() || 'Jullie logo';
  const langsteWoord = Math.max(...naam.split(/\s+/).map((w) => w.length), 1);
  const tekens = Math.min(naam.length, Math.max(langsteWoord, Math.ceil(naam.length / 2)));
  const fontCqw = Math.min(breedte * 0.3, (breedte * 1.3) / Math.max(tekens, 3));

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} style={{ containerType: 'inline-size' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fotoUrl} alt={alt} decoding="async" className="block h-full w-full object-contain" />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`Logo ${bedrijfsnaam}`}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute max-h-[22%] object-contain"
          style={{ ...stijl, filter: 'drop-shadow(0 0 0.6px rgba(255,255,255,.75)) drop-shadow(0 0 0.6px rgba(255,255,255,.5))' }}
        />
      ) : (
        <span
          className="pointer-events-none absolute text-center font-display font-extrabold uppercase leading-[1.05] tracking-wide text-white"
          style={{
            ...stijl,
            fontSize: `${fontCqw}cqw`,
            textShadow: '0 0 1px rgba(0,0,0,.45)',
            overflowWrap: 'anywhere',
          }}
        >
          {naam}
        </span>
      )}
    </div>
  );
}
