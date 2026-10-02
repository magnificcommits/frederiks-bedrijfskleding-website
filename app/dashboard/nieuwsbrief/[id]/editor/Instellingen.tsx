'use client';

/**
 * Instellingen van het geselecteerde element (blok of sectie) en de algemene
 * instellingen van de hele nieuwsbrief.
 */
import { useState, type Dispatch, type ReactNode } from 'react';
import {
  LETTERTYPEN,
  MERGE_TAGS,
  SOCIAL_KANALEN,
  STRUCTUREN,
  type Blok,
  type BlokStijl,
  type Instellingen,
  type Lettertype,
  type Sectie,
  type SocialKanaal,
} from '@/lib/nieuwsbrief/types';
import { AfbeeldingKiezer, ProductZoeker } from './Kiezers';
import { StructuurPlaatje } from './iconen';
import type { Actie, BlokPatch, SectiePatch } from './state';
import { Groepkop, KleurVeld, PaddingVeld, Rij, Schakelaar, Segment, Stapper, TekstVeld, UitlijningKeuze, VerbergenKeuze } from './velden';

/* ------------------------------------------------------------------ */
/* Blok                                                                */
/* ------------------------------------------------------------------ */

const MET_TEKSTKLEUR = new Set(['tekst', 'kop', 'product', 'webversie', 'afmelden']);
const MET_REGELAFSTAND = new Set(['tekst', 'kop', 'product', 'webversie', 'afmelden']);
const MET_LETTERGROOTTE = new Set(['tekst', 'kop', 'knop', 'product', 'webversie', 'afmelden']);
const ZONDER_UITLIJNING = new Set(['ruimte']);

const SOCIAL_LABEL: Record<SocialKanaal, { label: string; voorbeeld: string }> = {
  facebook: { label: 'Facebook', voorbeeld: 'https://www.facebook.com/...' },
  instagram: { label: 'Instagram', voorbeeld: 'https://www.instagram.com/...' },
  linkedin: { label: 'LinkedIn', voorbeeld: 'https://www.linkedin.com/company/...' },
  whatsapp: { label: 'WhatsApp', voorbeeld: '06 12345678' },
  email: { label: 'E-mail', voorbeeld: 'info@frederiksbedrijfskleding.nl' },
};

export function BlokInstellingen({ blok, dispatch }: { blok: Blok; dispatch: Dispatch<Actie> }) {
  const id = blok.id;
  const wijzig = (patch: BlokPatch, sleutel?: string) =>
    dispatch({ type: 'blokWijzigen', blokId: id, patch, sleutel: sleutel ? `${id}:${sleutel}` : undefined, tijd: Date.now() });
  const stijl = (patch: Partial<BlokStijl>, sleutel?: string) => wijzig({ stijl: patch }, sleutel ? `stijl.${sleutel}` : undefined);
  const s = blok.stijl;

  return (
    <div>
      <Groepkop>Inhoud</Groepkop>
      {blok.type === 'tekst' && (
        <div className="border-b border-line px-4 py-3 text-[13px] leading-snug text-warm">
          <p>
            Klik in de nieuwsbrief op de tekst om te typen. Met de werkbalk die dan verschijnt maak je tekst vet, zet je een link of voeg
            je de naam van de ontvanger in.
          </p>
          <p className="mt-2 font-semibold text-ink-800">Persoonlijke velden</p>
          <ul className="mt-1 space-y-0.5">
            {MERGE_TAGS.map((m) => (
              <li key={m.tag}>
                <span className="font-mono text-ink-800">{m.tag}</span> {m.uitleg.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {blok.type === 'kop' && (
        <>
          <TekstVeld label="Tekst" waarde={blok.tekst} onChange={(v) => wijzig({ tekst: v }, 'tekst')} hint="Je kunt de kop ook direct in de nieuwsbrief aanpassen." />
          <Rij label="Soort kop">
            <Segment
              label="Soort kop"
              waarde={blok.niveau}
              onChange={(n) => wijzig({ niveau: n, stijl: { lettergrootte: n === 1 ? 28 : n === 2 ? 22 : 18 } })}
              opties={[
                { waarde: 1, label: 'Groot' },
                { waarde: 2, label: 'Middel' },
                { waarde: 3, label: 'Klein' },
              ]}
            />
          </Rij>
          <Rij label="Als gekleurde balk" hint="Een balk over de hele breedte, zoals 'Tijd voor het voorjaar!'.">
            <Schakelaar aan={blok.balk} onChange={(v) => wijzig({ balk: v })} label="Kop als gekleurde balk" />
          </Rij>
          <Rij label="Vetgedrukt">
            <Schakelaar aan={blok.vet !== false} onChange={(v) => wijzig({ vet: v })} label="Kop vetgedrukt" />
          </Rij>
          <Rij label="Ruimte tussen letters">
            <Stapper waarde={blok.letterafstand ?? 0} onChange={(n) => wijzig({ letterafstand: n }, 'letterafstand')} min={0} max={1} stap={0.05} label="Ruimte tussen letters" />
          </Rij>
        </>
      )}

      {blok.type === 'afbeelding' && (
        <>
          <AfbeeldingKiezer
            src={blok.src}
            onKies={(k) => wijzig({ src: k.src, ...(k.alt && !blok.alt ? { alt: k.alt } : {}), ...(k.link && !blok.link ? { link: k.link } : {}) })}
          />
          <TekstVeld
            label="Link (waar gaat de afbeelding heen als je erop klikt)"
            type="url"
            waarde={blok.link}
            onChange={(v) => wijzig({ link: v }, 'link')}
            placeholder="https://www.frederiksbedrijfskleding.nl/..."
          />
          <TekstVeld
            label="Alternatieve tekst"
            waarde={blok.alt}
            onChange={(v) => wijzig({ alt: v }, 'alt')}
            placeholder="Bijv. Werkjas in zwart"
            hint="Deze tekst zie je als de afbeelding niet laadt. Ook belangrijk voor mensen die slecht zien."
          />
          <Rij label="Aanpassen aan breedte" hint={blok.breedte === 'vol' ? 'De afbeelding vult de hele kolom.' : undefined}>
            <Schakelaar aan={blok.breedte === 'vol'} onChange={(v) => wijzig({ breedte: v ? 'vol' : 300 })} label="Afbeelding aanpassen aan de breedte" />
          </Rij>
          {blok.breedte !== 'vol' && (
            <Rij label="Breedte">
              <Stapper waarde={blok.breedte} onChange={(n) => wijzig({ breedte: n }, 'breedte')} min={20} max={800} stap={10} label="Breedte van de afbeelding" eenheid="px" />
            </Rij>
          )}
          <Rij label="Ronde hoeken">
            <Stapper waarde={blok.radius} onChange={(n) => wijzig({ radius: n }, 'radius')} min={0} max={200} label="Ronde hoeken" eenheid="px" />
          </Rij>
        </>
      )}

      {blok.type === 'knop' && (
        <>
          <TekstVeld label="Tekst op de knop" waarde={blok.tekst} onChange={(v) => wijzig({ tekst: v }, 'tekst')} />
          <TekstVeld label="Link" type="url" waarde={blok.link} onChange={(v) => wijzig({ link: v }, 'link')} placeholder="https://www.frederiksbedrijfskleding.nl/..." />
          <Rij label="Kleur van de knop">
            <KleurVeld label="Kleur van de knop" waarde={blok.achtergrond} onChange={(v) => wijzig({ achtergrond: v })} />
          </Rij>
          <Rij label="Kleur van de tekst">
            <KleurVeld label="Kleur van de knoptekst" waarde={blok.tekstkleur} onChange={(v) => wijzig({ tekstkleur: v })} />
          </Rij>
          <Rij label="Ronde hoeken">
            <Stapper waarde={blok.radius} onChange={(n) => wijzig({ radius: n }, 'radius')} min={0} max={60} label="Ronde hoeken van de knop" eenheid="px" />
          </Rij>
          <Rij label="Over de hele breedte">
            <Schakelaar aan={blok.volleBreedte} onChange={(v) => wijzig({ volleBreedte: v })} label="Knop over de hele breedte" />
          </Rij>
        </>
      )}

      {blok.type === 'scheiding' && (
        <>
          <Rij label="Kleur van de lijn">
            <KleurVeld label="Kleur van de lijn" waarde={blok.kleur} onChange={(v) => wijzig({ kleur: v })} />
          </Rij>
          <Rij label="Dikte">
            <Stapper waarde={blok.dikte} onChange={(n) => wijzig({ dikte: n }, 'dikte')} min={1} max={20} label="Dikte van de lijn" eenheid="px" />
          </Rij>
          <Rij label="Lengte">
            <Stapper waarde={blok.breedte} onChange={(n) => wijzig({ breedte: n }, 'breedte')} min={5} max={100} stap={5} label="Lengte van de lijn" eenheid="%" />
          </Rij>
          <Rij label="Soort lijn">
            <Segment
              label="Soort lijn"
              waarde={blok.lijnstijl ?? 'solid'}
              onChange={(v) => wijzig({ lijnstijl: v })}
              opties={[
                { waarde: 'solid', label: 'Doorgetrokken' },
                { waarde: 'dashed', label: 'Streepjes' },
                { waarde: 'dotted', label: 'Puntjes' },
              ]}
            />
          </Rij>
        </>
      )}

      {blok.type === 'ruimte' && (
        <Rij label="Hoogte">
          <Stapper waarde={blok.hoogte} onChange={(n) => wijzig({ hoogte: n }, 'hoogte')} min={0} max={300} stap={4} label="Hoogte van de witruimte" eenheid="px" />
        </Rij>
      )}

      {blok.type === 'social' && (
        <>
          {SOCIAL_KANALEN.map((k) => (
            <TekstVeld
              key={k}
              label={SOCIAL_LABEL[k].label}
              waarde={blok.links[k] ?? ''}
              onChange={(v) => wijzig({ links: { ...blok.links, [k]: v } }, `links.${k}`)}
              placeholder={SOCIAL_LABEL[k].voorbeeld}
            />
          ))}
          <p className="border-b border-line px-4 py-2 text-[12px] text-warm">Laat een veld leeg om dat icoon niet te tonen.</p>
          <Rij label="Kleur van de iconen">
            <KleurVeld label="Kleur van de iconen" waarde={blok.iconKleur} onChange={(v) => wijzig({ iconKleur: v })} />
          </Rij>
          <Rij label="Grootte">
            <Stapper waarde={blok.grootte} onChange={(n) => wijzig({ grootte: n }, 'grootte')} min={20} max={56} stap={2} label="Grootte van de iconen" eenheid="px" />
          </Rij>
        </>
      )}

      {blok.type === 'product' && <ProductVelden blok={blok} wijzig={wijzig} />}

      {blok.type === 'webversie' && (
        <TekstVeld label="Tekst van de link" waarde={blok.tekst} onChange={(v) => wijzig({ tekst: v }, 'tekst')} hint="Deze link opent de nieuwsbrief in de browser." />
      )}

      {blok.type === 'afmelden' && (
        <>
          <TekstVeld label="Uitleg" meerRegels waarde={blok.tekst} onChange={(v) => wijzig({ tekst: v }, 'tekst')} hint="Waarom krijgt iemand deze mail? Mag ook leeg." />
          <TekstVeld label="Tekst van de afmeldlink" waarde={blok.linkTekst} onChange={(v) => wijzig({ linkTekst: v }, 'linkTekst')} />
        </>
      )}

      <Groepkop>Opmaak</Groepkop>
      {MET_TEKSTKLEUR.has(blok.type) && (
        <Rij label="Tekstkleur">
          <KleurVeld label="Tekstkleur" waarde={s.tekstkleur} onChange={(v) => stijl({ tekstkleur: v })} leeg="Standaard" />
        </Rij>
      )}
      <Rij label="Achtergrondkleur">
        <KleurVeld label="Achtergrondkleur" waarde={s.achtergrond} onChange={(v) => stijl({ achtergrond: v })} leeg="Transparant" />
      </Rij>
      {!ZONDER_UITLIJNING.has(blok.type) && (
        <Rij label="Uitlijning">
          <UitlijningKeuze waarde={s.uitlijning} onChange={(u) => stijl({ uitlijning: u })} />
        </Rij>
      )}
      {MET_LETTERGROOTTE.has(blok.type) && (
        <Rij label="Lettergrootte">
          <Stapper waarde={s.lettergrootte} onChange={(n) => stijl({ lettergrootte: n }, 'lettergrootte')} min={8} max={72} label="Lettergrootte" eenheid="px" />
        </Rij>
      )}
      {MET_REGELAFSTAND.has(blok.type) && (
        <Rij label="Regelafstand">
          <Segment
            label="Regelafstand"
            waarde={[1.2, 1.4, 1.6, 2].includes(s.regelafstand) ? s.regelafstand : -1}
            onChange={(n) => n > 0 && stijl({ regelafstand: n })}
            opties={[
              { waarde: 1.2, label: 'Krap' },
              { waarde: 1.4, label: 'Normaal' },
              { waarde: 1.6, label: 'Ruim' },
              { waarde: 2, label: 'Extra' },
            ]}
          />
        </Rij>
      )}
      <PaddingVeld waarde={s.padding} onChange={(p) => stijl({ padding: p }, 'padding')} />
      <VerbergenKeuze waarde={s.verbergen} onChange={(v) => stijl({ verbergen: v })} />
    </div>
  );
}

function ProductVelden({ blok, wijzig }: { blok: Extract<Blok, { type: 'product' }>; wijzig: (p: BlokPatch, sleutel?: string) => void }) {
  const [zoeken, setZoeken] = useState(!blok.productId && !blok.naam);
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-ink-800">Artikel uit het assortiment</span>
          {!zoeken && (
            <button type="button" onClick={() => setZoeken(true)} className="knop-stil">
              Ander artikel kiezen
            </button>
          )}
        </div>
        {zoeken ? (
          <ProductZoeker
            autoFocus
            onKies={(p) => {
              wijzig({ productId: p.id, naam: p.naam, merk: p.merk ?? '', foto: p.foto ?? '', prijs: p.prijs, link: p.url });
              setZoeken(false);
            }}
          />
        ) : (
          <p className="text-[13px] text-warm">{blok.naam || 'Nog geen artikel gekozen.'}</p>
        )}
      </div>
      <TekstVeld label="Naam" waarde={blok.naam} onChange={(v) => wijzig({ naam: v }, 'naam')} />
      <TekstVeld label="Merk" waarde={blok.merk} onChange={(v) => wijzig({ merk: v }, 'merk')} />
      <AfbeeldingKiezer label="Foto" src={blok.foto} metAssortiment={false} onKies={(k) => wijzig({ foto: k.src })} />
      <TekstVeld label="Link naar het artikel" type="url" waarde={blok.link} onChange={(v) => wijzig({ link: v }, 'link')} />
      <TekstVeld label="Tekst van de link" waarde={blok.knopTekst} onChange={(v) => wijzig({ knopTekst: v }, 'knopTekst')} hint="Bijv. Bekijk of Meer info. Leeg = geen link-tekst." />
      <Rij label="Prijs tonen" hint="Staat standaard uit: op de website staan ook geen prijzen.">
        <Schakelaar aan={blok.toonPrijs} onChange={(v) => wijzig({ toonPrijs: v })} label="Prijs tonen" />
      </Rij>
      {blok.toonPrijs && (
        <Rij label="Prijs excl. btw">
          <Stapper waarde={blok.prijs ?? 0} onChange={(n) => wijzig({ prijs: n }, 'prijs')} min={0} max={100000} stap={1} label="Prijs excl. btw" eenheid="euro" />
        </Rij>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sectie                                                              */
/* ------------------------------------------------------------------ */

const zelfde = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= 1);

export function SectieInstellingen({
  sectie,
  dispatch,
  moduleFormulier,
}: {
  sectie: Sectie;
  dispatch: Dispatch<Actie>;
  moduleFormulier: ReactNode;
}) {
  const id = sectie.id;
  const wijzig = (patch: SectiePatch, sleutel?: string) =>
    dispatch({ type: 'sectieWijzigen', sectieId: id, patch, sleutel: sleutel ? `${id}:${sleutel}` : undefined, tijd: Date.now() });
  const st = sectie.stijl;
  const n = sectie.kolommen.length;

  return (
    <div>
      {moduleFormulier}
      <Groepkop>Structuur</Groepkop>
      <div className="border-b border-line px-4 py-3">
        <span className="mb-2 block text-[13px] font-semibold text-ink-800">Kolommen</span>
        <div className="grid grid-cols-3 gap-2">
          {STRUCTUREN.map((s) => {
            const aan = zelfde(s.verhouding, sectie.verhouding);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => dispatch({ type: 'sectieStructuur', sectieId: id, verhouding: s.verhouding })}
                aria-pressed={aan}
                title={s.label}
                className={`flex flex-col items-center gap-1 rounded-md border p-1.5 text-[10px] leading-tight ${aan ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-line text-ink-600 hover:border-blue-300'}`}
              >
                <StructuurPlaatje verhouding={s.verhouding} />
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-warm">Kies je minder kolommen, dan schuiven de blokken naar de laatste kolom die overblijft.</p>
      </div>
      {n === 2 && (
        <Rij label="Breedte linkerkolom">
          <Stapper
            waarde={sectie.verhouding[0]}
            onChange={(v) => wijzig({ verhouding: [Math.round(v), 100 - Math.round(v)] }, 'verhouding')}
            min={20}
            max={80}
            stap={5}
            label="Breedte linkerkolom"
            eenheid="%"
          />
        </Rij>
      )}
      {n > 1 && (
        <Rij label="Onder elkaar op een telefoon" hint="Op een smal scherm komen de kolommen onder elkaar te staan. Meestal het beste.">
          <Schakelaar aan={sectie.stapelenOpMobiel} onChange={(v) => wijzig({ stapelenOpMobiel: v })} label="Kolommen onder elkaar op een telefoon" />
        </Rij>
      )}

      <Groepkop>Opmaak</Groepkop>
      <TekstVeld label="Naam (alleen voor jezelf)" waarde={sectie.naam ?? ''} onChange={(v) => wijzig({ naam: v }, 'naam')} placeholder="Bijv. Header of Productfoto's" />
      <Rij label="Achtergrond sectie" hint="De kleur achter de hele sectie, tot aan de randen van de brief.">
        <KleurVeld label="Achtergrond sectie" waarde={st.achtergrond} onChange={(v) => wijzig({ stijl: { achtergrond: v } })} leeg="Transparant" />
      </Rij>
      <Rij label="Achtergrond inhoud" hint="Alleen het vlak binnen de padding, bijv. voor een gekleurd kader.">
        <KleurVeld label="Achtergrond inhoud" waarde={st.inhoudAchtergrond} onChange={(v) => wijzig({ stijl: { inhoudAchtergrond: v } })} leeg="Transparant" />
      </Rij>
      <Rij label="Achtergrondafbeelding" hint={st.achtergrondAfbeelding !== undefined ? 'Let op: niet elk mailprogramma toont een achtergrondafbeelding. Kies ook een achtergrondkleur.' : undefined}>
        <Schakelaar
          aan={st.achtergrondAfbeelding !== undefined}
          onChange={(v) => wijzig({ stijl: { achtergrondAfbeelding: v ? '' : undefined } })}
          label="Achtergrondafbeelding gebruiken"
        />
      </Rij>
      {st.achtergrondAfbeelding !== undefined && (
        <AfbeeldingKiezer label="Achtergrondafbeelding" src={st.achtergrondAfbeelding} onKies={(k) => wijzig({ stijl: { achtergrondAfbeelding: k.src } })} />
      )}
      <Rij label="Rand van de inhoud">
        <Schakelaar
          aan={Boolean(st.rand)}
          onChange={(v) => wijzig({ stijl: { rand: v ? { breedte: 1, kleur: '#e4e2e0', stijl: 'solid' } : null } })}
          label="Rand om de inhoud"
        />
      </Rij>
      {st.rand && (
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-warm">Dikte</span>
            <Stapper waarde={st.rand.breedte} onChange={(b) => st.rand && wijzig({ stijl: { rand: { ...st.rand, breedte: b } } }, 'rand')} min={1} max={20} label="Dikte van de rand" eenheid="px" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[13px] text-warm">Soort</span>
            <Segment
              label="Soort rand"
              waarde={st.rand.stijl}
              onChange={(s) => st.rand && wijzig({ stijl: { rand: { ...st.rand, stijl: s } } })}
              opties={[
                { waarde: 'solid', label: 'Lijn' },
                { waarde: 'dashed', label: 'Streepjes' },
                { waarde: 'dotted', label: 'Puntjes' },
              ]}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[13px] text-warm">Kleur</span>
            <KleurVeld label="Kleur van de rand" waarde={st.rand.kleur} onChange={(k) => st.rand && wijzig({ stijl: { rand: { ...st.rand, kleur: k } } })} />
          </div>
        </div>
      )}
      <Rij label="Ronde hoeken">
        <Stapper waarde={st.radius} onChange={(r) => wijzig({ stijl: { radius: r } }, 'radius')} min={0} max={60} label="Ronde hoeken van de inhoud" eenheid="px" />
      </Rij>
      <PaddingVeld waarde={st.padding} onChange={(p) => wijzig({ stijl: { padding: p } }, 'padding')} label="Ruimte rondom (padding)" />
      <VerbergenKeuze waarde={sectie.verbergen} onChange={(v) => wijzig({ verbergen: v })} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Algemene instellingen                                               */
/* ------------------------------------------------------------------ */

export function AlgemeneInstellingen({ inst, dispatch }: { inst: Instellingen; dispatch: Dispatch<Actie> }) {
  const zet = (patch: Partial<Instellingen>, sleutel?: string) => dispatch({ type: 'instellingen', patch, sleutel: sleutel ? `inst:${sleutel}` : undefined, tijd: Date.now() });
  return (
    <div>
      <Groepkop>Achtergrond en breedte</Groepkop>
      <Rij label="Achtergrondkleur" hint="De kleur rondom de brief.">
        <KleurVeld label="Achtergrondkleur" waarde={inst.achtergrond} onChange={(v) => zet({ achtergrond: v })} />
      </Rij>
      <Rij label="Achtergrond inhoud" hint="De kleur van de brief zelf.">
        <KleurVeld label="Achtergrond inhoud" waarde={inst.inhoudAchtergrond} onChange={(v) => zet({ inhoudAchtergrond: v })} />
      </Rij>
      <Rij label="Breedte van de brief" hint="600 px is de standaard en werkt in elk mailprogramma.">
        <Stapper waarde={inst.breedte} onChange={(n) => zet({ breedte: n }, 'breedte')} min={480} max={800} stap={10} label="Breedte van de brief" eenheid="px" />
      </Rij>
      <Groepkop>Tekst</Groepkop>
      <Rij label="Lettertype" hint="Alleen lettertypes die in elk mailprogramma werken.">
        <select
          value={inst.lettertype}
          onChange={(e) => zet({ lettertype: e.target.value as Lettertype })}
          aria-label="Lettertype"
          className="veld w-40 text-[14px]"
        >
          {(Object.keys(LETTERTYPEN) as Lettertype[]).map((k) => (
            <option key={k} value={k} style={{ fontFamily: LETTERTYPEN[k].stack }}>
              {LETTERTYPEN[k].label}
            </option>
          ))}
        </select>
      </Rij>
      <Rij label="Standaard tekstkleur">
        <KleurVeld label="Standaard tekstkleur" waarde={inst.tekstkleur} onChange={(v) => zet({ tekstkleur: v })} />
      </Rij>
      <Rij label="Kleur van links">
        <KleurVeld label="Kleur van links" waarde={inst.linkkleur} onChange={(v) => zet({ linkkleur: v })} />
      </Rij>
      <Rij label="Kleur van koppen">
        <KleurVeld label="Kleur van koppen" waarde={inst.kopkleur} onChange={(v) => zet({ kopkleur: v })} />
      </Rij>
    </div>
  );
}
