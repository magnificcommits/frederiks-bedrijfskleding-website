import { describe, expect, it } from 'vitest';
import { schoonPad, trackerSlaatOver } from '@/lib/leadHerkomst';
import { controleerLogo, herkenBestand, logoBestandsnaam, logoBijlage } from '@/lib/bijlagen';
import { alleenNieuweRegels, ilikePatroon, samenvoegGrens, voegBerichtSamen, zonderOnbekendeProducten } from '@/lib/kms/leadInnameLogica';
import { isDubbeleBestelling, regelsSleutel } from '@/lib/portaal/dubbelBestelling';
import { MIN_REVIEWS_VOOR_GEMIDDELDE, reviewCijfers } from '@/lib/reviews/cijfers';
import { NPS_ORDERSTATUSSEN, isNpsOrderstatus } from '@/lib/reviews/npsStatussen';
import { BEWAARTERMIJNEN, bewaarGrens } from '@/lib/avg/bewaartermijnen';
import { annuleerBlokkade } from '@/lib/kms/orders';

const dataUrl = (mime: string, bytes: number[] | string) =>
  `data:${mime};base64,${Buffer.from(typeof bytes === 'string' ? bytes : Uint8Array.from(bytes)).toString('base64')}`;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];

describe('schoonPad: tokens uit persoonlijke links', () => {
  it('haalt het token weg bij afspraak beheren, beoordeling en nieuwsbrief', () => {
    expect(schoonPad('/afspraak/beheer/AbCdEf123456789012345678')).toBe('/afspraak/beheer');
    expect(schoonPad('/beoordeling/AbCdEf123456789012345678?score=9')).toBe('/beoordeling');
    expect(schoonPad('/nieuwsbrief/AbCdEf123456789012345678')).toBe('/nieuwsbrief');
    expect(schoonPad('/nieuwsbrief/bevestigen/geheim')).toBe('/nieuwsbrief');
  });
  it('laat de bestaande tokenpaden en gewone paden met rust', () => {
    expect(schoonPad('/drukproef/geheim')).toBe('/drukproef');
    expect(schoonPad('/k/geheim')).toBe('/k');
    expect(schoonPad('/afspraak')).toBe('/afspraak');
    expect(schoonPad('/nieuwsbrief')).toBe('/nieuwsbrief');
    expect(schoonPad('/assortiment/polo?x=1#a')).toBe('/assortiment/polo');
  });
});

describe('trackerSlaatOver', () => {
  it('slaat tokenpagina\'s, KMS en portaal over', () => {
    for (const p of ['/afspraak/beheer/abc', '/beoordeling/abc', '/nieuwsbrief/abc', '/dashboard/leads', '/portaal', '/k/abc', '/drukproef/abc']) {
      expect(trackerSlaatOver(p)).toBe(true);
    }
    expect(trackerSlaatOver(null)).toBe(true);
  });
  it('telt gewone pagina\'s wel mee, ook de boekpagina en de nieuwsbriefpagina zelf', () => {
    for (const p of ['/', '/afspraak', '/nieuwsbrief', '/assortiment/polo', '/kennisbank/x']) {
      expect(trackerSlaatOver(p)).toBe(false);
    }
  });
});

describe('logo-upload: type uit de eerste bytes', () => {
  it('herkent png, jpg, webp, gif en pdf', () => {
    expect(herkenBestand(Uint8Array.from(PNG))).toBe('png');
    expect(herkenBestand(Uint8Array.from(JPG))).toBe('jpg');
    expect(herkenBestand(Uint8Array.from(WEBP))).toBe('webp');
    expect(herkenBestand(Uint8Array.from(GIF))).toBe('gif');
    expect(herkenBestand(Uint8Array.from(PDF))).toBe('pdf');
    expect(herkenBestand(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(herkenBestand(new Uint8Array())).toBeNull();
  });
  it('weigert SVG op de publieke route, ook als de inhoud een nette svg is', () => {
    const svg = dataUrl('image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(controleerLogo(svg, { svgToegestaan: false })).toBeNull();
    expect(controleerLogo(svg)).toBeNull();
    expect(controleerLogo(svg, { svgToegestaan: true })?.ext).toBe('svg');
  });
  it('weigert een bestand dat zich als afbeelding voordoet', () => {
    expect(controleerLogo(dataUrl('image/png', '<html><script>alert(1)</script></html>'))).toBeNull();
    expect(controleerLogo(dataUrl('image/png', PDF))).toBeNull();
    expect(controleerLogo(dataUrl('image/svg+xml', PNG), { svgToegestaan: true })).toBeNull();
    expect(controleerLogo(dataUrl('text/html', PNG))).toBeNull();
    expect(controleerLogo('geen data-url')).toBeNull();
  });
  it('neemt type en extensie van de bytes, niet van wat de afzender opgeeft', () => {
    const logo = controleerLogo(dataUrl('image/png', JPG));
    expect(logo?.ext).toBe('jpg');
    expect(logo?.mime).toBe('image/jpeg');
    expect(controleerLogo(dataUrl('image/webp', WEBP))?.mime).toBe('image/webp');
  });
  it('houdt zich aan de maximale grootte', () => {
    expect(controleerLogo(dataUrl('image/png', PNG), { maxBytes: 4 })).toBeNull();
    expect(controleerLogo(dataUrl('image/png', PNG), { maxBytes: 100 })?.ext).toBe('png');
  });
  it('leidt de extensie van de bestandsnaam altijd af van het gecontroleerde type', () => {
    expect(logoBestandsnaam('factuur.html', 'png')).toBe('factuur.png');
    expect(logoBestandsnaam('logo.svg', 'jpg')).toBe('logo.jpg');
    expect(logoBestandsnaam('', 'webp')).toBe('logo.webp');
    expect(logoBestandsnaam('../../etc/passwd', 'png')).not.toContain('/');
    expect(logoBijlage(dataUrl('image/png', PNG), 'mijn logo.exe', { svgToegestaan: false })?.filename).toBe('mijn logo.png');
    expect(logoBijlage(dataUrl('image/svg+xml', '<svg></svg>'), 'logo.svg', { svgToegestaan: false })).toBeNull();
  });
});

describe('weblead-inname: pure logica', () => {
  const regel = (o: Partial<Parameters<typeof zonderOnbekendeProducten>[0][number]> = {}) => ({
    product_id: null,
    omschrijving: 'Polo',
    kleur: 'Navy',
    maat: 'L',
    aantal: 5,
    opmerking: null,
    ...o,
  });

  it('zet onbekende product-id\'s op null en laat bekende staan', () => {
    const uit = zonderOnbekendeProducten([regel({ product_id: 'a' }), regel({ product_id: 'b' }), regel()], new Set(['a']));
    expect(uit.map((r) => r.product_id)).toEqual(['a', null, null]);
    expect(uit[1].omschrijving).toBe('Polo');
  });
  it('voegt alleen regels toe die nog niet bij de lead staan', () => {
    const bestaand = [regel({ product_id: 'a' })];
    const nieuw = [regel({ product_id: 'a', kleur: ' navy ' }), regel({ product_id: 'a', aantal: 10 }), regel({ product_id: 'a', aantal: 10 })];
    const uit = alleenNieuweRegels(bestaand, nieuw);
    expect(uit).toHaveLength(1);
    expect(uit[0].aantal).toBe(10);
  });
  it('zet een tweede bericht onder het eerste, maar hetzelfde bericht niet dubbel', () => {
    expect(voegBerichtSamen('Eerste', 'Tweede', '7 okt')).toBe('Eerste\n\nAanvulling van 7 okt:\nTweede');
    expect(voegBerichtSamen('Eerste', 'Eerste', '7 okt')).toBe('Eerste');
    expect(voegBerichtSamen(null, 'Tweede', '7 okt')).toBe('Tweede');
    expect(voegBerichtSamen('Eerste', '', '7 okt')).toBe('Eerste');
    expect(voegBerichtSamen(null, null, '7 okt')).toBeNull();
  });
  it('rekent de samenvoeggrens zeven dagen terug en maakt het zoekpatroon veilig', () => {
    expect(samenvoegGrens(new Date('2026-10-08T12:00:00Z'))).toBe('2026-10-01T12:00:00.000Z');
    expect(ilikePatroon(' jan_de%vries@x.nl ')).toBe('jan\\_de\\%vries@x.nl');
  });
});

describe('dubbel bestellen in het portaal', () => {
  const a = { variant_id: 'v1', aantal: 2 };
  const b = { variant_id: 'v2', aantal: 1 };
  it('herkent dezelfde regels, ongeacht de volgorde of opsplitsing', () => {
    expect(isDubbeleBestelling([a, b], [[b, a]])).toBe(true);
    expect(isDubbeleBestelling([a], [[{ variant_id: 'v1', aantal: 1 }, { variant_id: 'v1', aantal: 1 }]])).toBe(true);
    expect(regelsSleutel([a, b])).toBe(regelsSleutel([b, a]));
  });
  it('laat een andere bestelling door', () => {
    expect(isDubbeleBestelling([a, b], [[a]])).toBe(false);
    expect(isDubbeleBestelling([a], [[{ variant_id: 'v1', aantal: 3 }]])).toBe(false);
    expect(isDubbeleBestelling([a], [])).toBe(false);
    expect(isDubbeleBestelling([], [[]])).toBe(false);
  });
});

describe('reviews: gemiddelde over alle antwoorden', () => {
  it('toont geen gemiddelde onder de vijf antwoorden', () => {
    const c = reviewCijfers([10, 9, 8, 10]);
    expect(c.aantal).toBe(4);
    expect(c.toonbaar).toBe(false);
  });
  it('telt alle beantwoorde reviews mee, ook de lage', () => {
    const c = reviewCijfers([10, 10, 9, 4, 2, null, undefined]);
    expect(c.aantal).toBe(MIN_REVIEWS_VOOR_GEMIDDELDE);
    expect(c.gemiddelde).toBe(7);
    expect(c.toonbaar).toBe(true);
  });
  it('geeft zonder antwoorden geen gemiddelde', () => {
    expect(reviewCijfers([])).toEqual({ aantal: 0, gemiddelde: null, toonbaar: false });
  });
});

describe('NPS-mail: alleen als de order bij de klant is', () => {
  it('kent alleen verzonden, factureren en afgerond', () => {
    expect([...NPS_ORDERSTATUSSEN]).toEqual(['verzonden', 'factureren', 'afgerond']);
    expect(isNpsOrderstatus('compleet_geleverd')).toBe(false);
    expect(isNpsOrderstatus('geannuleerd')).toBe(false);
    expect(isNpsOrderstatus('verzonden')).toBe(true);
    expect(isNpsOrderstatus(null)).toBe(false);
  });
});

describe('order annuleren', () => {
  it('weigert als er een factuur is die geen concept is', () => {
    expect(annuleerBlokkade('nog_bestellen', ['verzonden'])).toBe('gefactureerd');
    expect(annuleerBlokkade('nog_bestellen', ['concept', 'betaald'])).toBe('gefactureerd');
  });
  it('weigert als de order al is uitgeleverd', () => {
    expect(annuleerBlokkade('verzonden', [])).toBe('uitgeleverd');
    expect(annuleerBlokkade('afgerond', ['concept'])).toBe('uitgeleverd');
  });
  it('laat annuleren toe zonder factuur of met alleen een concept', () => {
    expect(annuleerBlokkade('besteld', [])).toBeNull();
    expect(annuleerBlokkade('compleet_geleverd', ['concept'])).toBeNull();
  });
});

describe('bewaartermijnen', () => {
  const regel = (tabel: string) => BEWAARTERMIJNEN.find((r) => r.tabel === tabel);
  it('ruimt nooit bevestigde nieuwsbrief-aanmeldingen na 30 dagen op, en alleen die', () => {
    expect(regel('nieuwsbrief_inschrijvingen')).toMatchObject({ kolom: 'created_at', dagen: 30, leeg: ['bevestigd_op'], gevuld: ['bevestig_token'] });
  });
  it('ruimt afspraken 730 dagen na de afspraak op', () => {
    expect(regel('afspraken')).toMatchObject({ kolom: 'start_op', dagen: 730 });
    expect(regel('afspraken')?.leeg).toBeUndefined();
  });
  it('ruimt alleen onbeantwoorde review-verzoeken na 365 dagen op', () => {
    expect(regel('reviews')).toMatchObject({ dagen: 365 });
    expect(regel('reviews')?.leeg).toContain('score');
  });
  it('rekent de grens in dagen terug', () => {
    expect(bewaarGrens({ dagen: 30 }, Date.parse('2026-10-31T00:00:00Z'))).toBe('2026-10-01T00:00:00.000Z');
  });
});
