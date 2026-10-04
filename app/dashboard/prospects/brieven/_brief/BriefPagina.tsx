import type { CSSProperties, ReactNode } from 'react';
import LogoOpKleding from '@/components/kennismaking/LogoOpKleding';
import { site } from '@/content/site';
import { bedrijf } from '@/content/bedrijf';
import { logoDataUri } from '@/content/logoData';
import { CONTACT_FALLBACK } from '@/content/kennismaking';
import {
  BRIEF_LETTERTYPEN,
  BRIEF_KLEUREN,
  VOETBALK_MM,
  inhoudBoven,
  inhoudOnder,
  type BriefBlok,
  type BriefOntwerp,
  type Uitlijning,
} from '@/lib/prospect/briefTypes';
import { alineas, postcodePlaats, vulVelden, type BriefPersoon } from '@/lib/prospect/briefRender';

/**
 * Eén A4-brief voor één prospect, in millimeters. Geen hooks: werkt als
 * servercomponent (printweergave) en in de editor (met `interactief`).
 *
 * Vaste plekken (niet verschuifbaar, de post schrijft ze voor):
 *  - briefhoofd rechtsboven, 14 mm van boven;
 *  - afzenderregel op 46 mm en adres op 52 mm van boven, 20 mm van links,
 *    85 x 35 mm: past in het venster van een DL- of C5-envelop.
 * Daaronder lopen de blokken van boven naar beneden. Wat niet past wordt
 * afgesneden; de editor en de controlestap meten dat en waarschuwen.
 */

const SCRIPT = "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive";
const STIL = '#6b6966';

const justify = (u: Uitlijning) => (u === 'midden' ? 'center' : u === 'rechts' ? 'flex-end' : 'flex-start');
const textAlign = (u: Uitlijning) => (u === 'midden' ? 'center' : u === 'rechts' ? 'right' : 'left');

export type Interactief = { geselecteerd: string | null; kies: (id: string) => void; zones?: boolean };

function Tekst({ tekst }: { tekst: string }) {
  const delen = alineas(tekst);
  return (
    <>
      {delen.map((alinea, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : '3mm 0 0' }}>
          {alinea.map((regel, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {regel.map((d, k) => (d.vet ? <strong key={k}>{d.tekst}</strong> : <span key={k}>{d.tekst}</span>))}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function Placeholder({ breedte, hoogte, tekst }: { breedte: number; hoogte: number; tekst: string }) {
  return (
    <div
      style={{ width: `${breedte}mm`, height: `${hoogte}mm`, border: '0.3mm dashed #c9c6c3', borderRadius: '2mm', color: '#9a9794', fontSize: '7pt' }}
      className="flex items-center justify-center bg-[#faf9f8] text-center"
    >
      {tekst}
    </div>
  );
}

function Kleding({ p, aantal, grootte, namen, interactief }: { p: BriefPersoon; aantal: number; grootte: number; namen: boolean; interactief: boolean }) {
  const lijst = p.mockups.slice(0, aantal);
  if (lijst.length === 0) {
    if (!interactief) return null;
    return (
      <>
        {Array.from({ length: aantal }, (_, i) => (
          <Placeholder key={i} breedte={grootte} hoogte={grootte} tekst="Kleding met logo" />
        ))}
      </>
    );
  }
  return (
    <>
      {lijst.map((a) => (
        <figure key={a.productId} style={{ width: `${grootte}mm`, margin: 0 }}>
          <LogoOpKleding
            fotoUrl={a.fotoUrl}
            alt={a.naam}
            logoUrl={p.logoUrl}
            bedrijfsnaam={p.bedrijfsnaam}
            positie={a.logoPositie}
            className="aspect-square w-full rounded-[2mm] border border-line bg-white"
          />
          {namen && (
            <figcaption className="truncate" style={{ marginTop: '1mm', fontSize: '6.5pt', color: STIL }}>
              {a.naam}
            </figcaption>
          )}
        </figure>
      ))}
    </>
  );
}

function blokInhoud(b: BriefBlok, o: BriefOntwerp, p: BriefPersoon, datum: string, interactief: boolean): ReactNode {
  const vul = (t: string) => vulVelden(t, p, datum);
  const i = o.instellingen;
  switch (b.type) {
    case 'betreft':
      return (
        <div>
          {b.plaatsDatum.trim() && <p style={{ margin: 0 }}>{vul(b.plaatsDatum)}</p>}
          {b.betreft.trim() && <p style={{ margin: b.plaatsDatum.trim() ? '5mm 0 0' : 0, fontWeight: 700 }}>{vul(b.betreft)}</p>}
        </div>
      );
    case 'kop': {
      const kleur = b.kleur || i.tekstkleur;
      if (b.balk) {
        return (
          <p style={{ margin: 0, background: i.accent, color: '#fff', padding: '2.5mm 4mm', fontWeight: 700, fontSize: `${b.grootte}pt`, lineHeight: 1.2, textAlign: textAlign(b.uitlijning) }}>
            {vul(b.tekst)}
          </p>
        );
      }
      return (
        <p className="font-display" style={{ margin: 0, color: kleur, fontWeight: 700, fontSize: `${b.grootte}pt`, lineHeight: 1.2, textAlign: textAlign(b.uitlijning), letterSpacing: '-0.01em' }}>
          {vul(b.tekst)}
        </p>
      );
    }
    case 'tekst':
      return (
        <div style={{ fontSize: b.grootte ? `${b.grootte}pt` : undefined, textAlign: textAlign(b.uitlijning) }}>
          <Tekst tekst={vul(b.tekst)} />
        </div>
      );
    case 'logo':
      return (
        <div style={{ display: 'flex', justifyContent: justify(b.uitlijning) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUri} alt={site.name} style={{ height: `${b.hoogte}mm`, width: 'auto' }} />
        </div>
      );
    case 'afbeelding':
      if (!b.src) return interactief ? <Placeholder breedte={60} hoogte={b.hoogte} tekst="Vul een afbeeldings-url in" /> : null;
      return (
        <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: justify(b.uitlijning) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.src} alt={b.alt} referrerPolicy="no-referrer" style={{ height: `${b.hoogte}mm`, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          {b.onderschrift.trim() && <figcaption style={{ marginTop: '1mm', fontSize: '7pt', color: STIL }}>{vul(b.onderschrift)}</figcaption>}
        </figure>
      );
    case 'mockups':
      return (
        <div style={{ display: 'flex', gap: '4mm', justifyContent: justify(b.uitlijning), alignItems: 'flex-start' }}>
          <Kleding p={p} aantal={b.aantal} grootte={b.grootte} namen={b.namen} interactief={interactief} />
        </div>
      );
    case 'qr': {
      const kort = p.korteUrl.replace(/^https?:\/\//, '');
      const code = p.qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.qr} alt={`QR-code naar ${kort}`} style={{ width: `${b.grootte}mm`, height: `${b.grootte}mm`, flexShrink: 0 }} />
      ) : (
        <Placeholder breedte={b.grootte} hoogte={b.grootte} tekst="QR-code" />
      );
      const midden = b.uitlijning === 'midden' && b.kledingErnaast === 0;
      const tekstUitlijning = midden ? 'center' : b.uitlijning === 'links' && b.kledingErnaast === 0 ? 'left' : 'right';
      const uitleg = (b.kop.trim() || b.tekst.trim() || b.toonUrl) && (
        <div style={{ fontSize: '8pt', lineHeight: 1.35, textAlign: tekstUitlijning }}>
          {b.kop.trim() && <p style={{ margin: 0, fontWeight: 700, fontSize: midden ? '10pt' : '8.5pt', color: i.tekstkleur }}>{vul(b.kop)}</p>}
          {b.tekst.trim() && <p style={{ margin: 0, color: STIL, whiteSpace: 'pre-line' }}>{vul(b.tekst)}</p>}
          {b.toonUrl && <p style={{ margin: '1.5mm 0 0', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '7.5pt' }}>{kort}</p>}
        </div>
      );
      const kader: CSSProperties = b.kader ? { border: `0.4mm solid ${i.accent}`, borderRadius: '2mm', padding: '3mm' } : {};
      const groep = midden ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm', ...kader }}>
          {b.kop.trim() && <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>{vul(b.kop)}</p>}
          {code}
          {(b.tekst.trim() || b.toonUrl) && (
            <div style={{ fontSize: '8pt', textAlign: 'center', lineHeight: 1.35 }}>
              {b.tekst.trim() && <p style={{ margin: 0, color: STIL, whiteSpace: 'pre-line' }}>{vul(b.tekst)}</p>}
              {b.toonUrl && <p style={{ margin: '1mm 0 0', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '7.5pt' }}>{kort}</p>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3mm', flexDirection: tekstUitlijning === 'left' ? 'row-reverse' : 'row', ...kader }}>
          {uitleg}
          {code}
        </div>
      );
      if (b.kledingErnaast > 0) {
        return (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4mm' }}>
            <Kleding p={p} aantal={b.kledingErnaast} grootte={b.grootte} namen interactief={interactief} />
            <div style={{ marginLeft: 'auto' }}>{groep}</div>
          </div>
        );
      }
      return <div style={{ display: 'flex', justifyContent: justify(b.uitlijning) }}>{groep}</div>;
    }
    case 'handtekening': {
      const voornaam = b.naam.trim().split(/\s+/)[0] ?? '';
      return (
        <div>
          {b.groet.trim() && <p style={{ margin: 0 }}>{b.groet}</p>}
          {b.stijl === 'script' && voornaam && (
            <p style={{ margin: '1mm 0 0', fontFamily: SCRIPT, fontSize: '20pt', lineHeight: 1, color: '#1c1c1c' }}>{voornaam}</p>
          )}
          {b.stijl === 'afbeelding' && b.afbeelding && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.afbeelding} alt={`Handtekening ${b.naam}`} referrerPolicy="no-referrer" style={{ height: '14mm', width: 'auto', marginTop: '1mm' }} />
          )}
          {b.stijl === 'afbeelding' && !b.afbeelding && interactief && <div style={{ marginTop: '1mm' }}><Placeholder breedte={40} hoogte={14} tekst="Handtekening (url)" /></div>}
          <p style={{ margin: '1mm 0 0' }}>
            {b.naam}
            {b.functie.trim() && (
              <>
                <br />
                <span style={{ color: STIL }}>{b.functie}</span>
              </>
            )}
          </p>
        </div>
      );
    }
    case 'voettekst':
      return <p style={{ margin: 0, fontSize: `${b.grootte}pt`, lineHeight: 1.4, color: STIL, textAlign: textAlign(b.uitlijning), whiteSpace: 'pre-line' }}>{vul(b.tekst)}</p>;
    case 'lijn':
      return <div style={{ borderTop: `${b.dikte}pt solid ${b.kleur || BRIEF_KLEUREN.lijn}` }} />;
    case 'ruimte':
      return interactief ? (
        <div className="flex h-full items-center justify-center text-[7pt] text-ink-300" style={{ minHeight: b.vul ? '3mm' : undefined }}>
          {b.vul ? 'vrije ruimte' : ''}
        </div>
      ) : null;
  }
}

export default function BriefPagina({
  ontwerp,
  persoon: p,
  datum,
  interactief,
}: {
  ontwerp: BriefOntwerp;
  persoon: BriefPersoon;
  datum: string;
  interactief?: Interactief;
}) {
  const i = ontwerp.instellingen;
  const font = BRIEF_LETTERTYPEN[i.lettertype]?.stack ?? BRIEF_LETTERTYPEN.arial.stack;
  const boven = inhoudBoven(i.briefhoofd);
  const onder = inhoudOnder(i.voetbalk);

  return (
    <article
      className="brief relative overflow-hidden bg-white shadow-card"
      data-brief=""
      data-naam={p.bedrijfsnaam}
      data-id={p.id}
      style={{ width: '210mm', height: '297mm', fontFamily: font, fontSize: `${i.lettergrootte}pt`, lineHeight: 1.45, color: i.tekstkleur }}
    >
      {i.briefhoofd === 'venster' && (
        <>
          <header className="absolute text-right" style={{ right: `${i.marge}mm`, top: '14mm', width: '70mm' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDataUri} alt={site.name} className="ml-auto w-auto" style={{ height: '16mm' }} />
            <p style={{ margin: '3mm 0 0', fontSize: '8pt', lineHeight: 1.35, color: STIL }}>
              {bedrijf.adres}<br />{bedrijf.postcode} {bedrijf.plaats}<br />{bedrijf.telefoon}<br />{bedrijf.email}<br />{bedrijf.website}
            </p>
          </header>
          <div className="absolute" style={{ left: '20mm', top: '46mm', width: '85mm' }}>
            <p style={{ margin: 0, paddingBottom: '1mm', borderBottom: '0.2mm solid #d6d3d0', fontSize: '6.5pt', color: '#9a9794' }}>
              {site.name} · {bedrijf.adres} · {bedrijf.postcode} {bedrijf.plaats}
            </p>
          </div>
          <address
            className="absolute not-italic"
            style={{
              left: '20mm', top: '52mm', width: '85mm', height: '35mm', fontSize: '10.5pt', lineHeight: 1.35,
              outline: interactief?.zones ? '0.3mm dashed #e8b48f' : undefined, outlineOffset: '1mm',
            }}
          >
            {p.bedrijfsnaam}<br />
            {p.contactpersoon ? `t.a.v. ${p.contactpersoon}` : CONTACT_FALLBACK}<br />
            {p.adres ? <>{p.adres}<br /></> : null}
            {postcodePlaats(p.postcode, p.plaats)}
            {interactief?.zones && !p.adres && <span className="block text-[7pt] text-amber-700">Adres ontbreekt nog</span>}
          </address>
        </>
      )}

      {i.briefhoofd === 'compact' && (
        <header className="absolute flex items-end justify-between" style={{ left: `${i.marge}mm`, right: `${i.marge}mm`, top: '14mm', paddingBottom: '3mm', borderBottom: `0.3mm solid ${BRIEF_KLEUREN.lijn}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUri} alt={site.name} className="w-auto" style={{ height: '12mm' }} />
          <p style={{ margin: 0, fontSize: '7.5pt', lineHeight: 1.35, color: STIL, textAlign: 'right' }}>
            {bedrijf.adres}, {bedrijf.postcode} {bedrijf.plaats}<br />{bedrijf.telefoon} · {bedrijf.website}
          </p>
        </header>
      )}

      <div
        data-brief-inhoud=""
        className="absolute flex flex-col"
        style={{ left: `${i.marge}mm`, right: `${i.marge}mm`, top: `${boven}mm`, bottom: `${onder}mm`, overflow: 'hidden' }}
      >
        {ontwerp.blokken.map((b) => {
          const inhoud = blokInhoud(b, ontwerp, p, datum, Boolean(interactief));
          const isVul = b.type === 'ruimte' && b.vul;
          const stijl: CSSProperties = isVul
            ? { flex: '1 1 0', minHeight: 0 }
            : { flexShrink: 0, marginTop: `${b.boven}mm`, height: b.type === 'ruimte' ? `${b.hoogte}mm` : undefined };
          if (!interactief) {
            if (inhoud == null && !isVul && b.type !== 'ruimte') return null;
            return (
              <div key={b.id} style={stijl}>
                {inhoud}
              </div>
            );
          }
          const actief = interactief.geselecteerd === b.id;
          return (
            <div
              key={b.id}
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                interactief.kies(b.id);
              }}
              className="cursor-pointer"
              style={{
                ...stijl,
                outline: actief ? '0.5mm solid #ec6726' : '0.2mm dashed transparent',
                outlineOffset: '1mm',
                borderRadius: '0.5mm',
                background: isVul && actief ? 'repeating-linear-gradient(45deg, #fdf3ec, #fdf3ec 2mm, #fff 2mm, #fff 4mm)' : undefined,
              }}
              onMouseEnter={(e) => {
                if (!actief) e.currentTarget.style.outline = '0.2mm dashed #e8b48f';
              }}
              onMouseLeave={(e) => {
                if (!actief) e.currentTarget.style.outline = '0.2mm dashed transparent';
              }}
            >
              {inhoud}
            </div>
          );
        })}
      </div>

      {i.voetbalk && (
        <footer
          className="absolute inset-x-0 bottom-0 flex items-center justify-between text-white"
          style={{ height: `${VOETBALK_MM}mm`, background: i.accent, padding: `0 ${i.marge}mm`, fontSize: '7pt' }}
        >
          <span>{site.name}</span>
          <span>{bedrijf.telefoon} · {bedrijf.email} · KvK {bedrijf.kvk}</span>
        </footer>
      )}
    </article>
  );
}
