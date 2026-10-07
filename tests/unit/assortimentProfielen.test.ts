import { describe, expect, it } from 'vitest';
import { PROFIELEN, kiesArtikelen, past, normUitNaam } from '@/lib/assortimentProfielen';
import { branches } from '@/content/branches';
import { vakgebieden } from '@/content/vakgebieden';

let n = 0;
const art = (merk: string, naam: string, categorieSlug: string, subcategorie: string | null = null) => ({
  id: String(++n), merk, naam, subcategorie, categorieSlug, maten: ['S', 'M', 'L'], kleuren: ['Zwart'],
});

const catalogus = [
  art('Snickers Workwear', 'D3O® Ergo Kniebeschermers', 'accessoires'),
  art('Snickers Workwear', 'AllroundWork, Geïsoleerd Overhemd', 'blouses-en-overhemden'),
  art('Snickers Workwear', 'AllroundWork, 2-Way Stretch Werkbroek met Holsterzakken', 'broeken'),
  art('Snickers Workwear', 'Service Broek', 'broeken'),
  art('WK. Designed To Work', 'Ecologisch koksjasje met korte mouwen uniseks', 'blouses-en-overhemden', 'Labjassen'),
  art('WK. Designed To Work', 'Broek zonder zakken uniseks', 'broeken'),
  art('WK. Designed To Work', 'Ademend T-shirt uniseks', 't-shirts-en-polos'),
  art('WK. Designed To Work', 'Veiligheidshesje voor kinderen', 'bodywarmers'),
  art('Xirtrum', 'XIRTRUM WAISTCOAT MEN', 'truien-en-vesten'),
  art('Xirtrum', 'XIRTRUM POLO MEN THE MICROFIBRE', 't-shirts-en-polos'),
  art('Brook Taverner', 'Aldwych Tailored Fit Trouser', 'broeken'),
  art('Brook Taverner', 'William Tailored Fit Jacket', 'blouses-en-overhemden'),
  art('Upower', 'AIKO ESD S3S CI LG FO SR', 'werkschoenen'),
  art('Fristads', 'Flamestat T-shirt lange mouwen 7072 TFLH', 't-shirts-en-polos'),
  art('Tricorp', 'Poloshirt 60°C Wasbaar', 't-shirts-en-polos'),
];

describe('assortiment per pagina', () => {
  it('heeft een profiel voor elke branche en elk vakgebied', () => {
    for (const b of branches) expect(PROFIELEN[`branche:${b.slug}`], b.slug).toBeDefined();
    for (const v of vakgebieden) expect(PROFIELEN[`vak:${v.slug}`], v.slug).toBeDefined();
  });

  it('toont op de koks- en horecapagina geen vakmanskleding', () => {
    for (const k of ['vak:keuken-en-bediening', 'branche:horeca-en-food']) {
      const namen = kiesArtikelen(catalogus, PROFIELEN[k]).map((p) => p.naam);
      expect(namen).toContain('Ecologisch koksjasje met korte mouwen uniseks');
      expect(namen.join(' ')).not.toMatch(/knie|holster|esd|flamestat|tailored fit trouser/i);
    }
  });

  it('toont geen koksjas, blazer of pantalon bij vakmensen', () => {
    for (const k of ['branche:bouw-en-infra', 'branche:installatie-en-techniek', 'vak:automotive-en-garage', 'branche:agrarisch-en-groen']) {
      const namen = catalogus.filter((p) => past(p, PROFIELEN[k])).map((p) => p.naam).join(' ');
      expect(namen, k).not.toMatch(/koksjas|tailored|xirtrum|waistcoat/i);
    }
  });

  it('vult nooit aan met artikelen die niet passen', () => {
    const weinig = [catalogus[4], catalogus[0], catalogus[2]];
    // Eén koksjas is te weinig voor een blok; de kniebeschermers en de werkbroek komen er niet bij.
    expect(kiesArtikelen(weinig, PROFIELEN['vak:keuken-en-bediening'])).toEqual([]);
  });

  it('nooit kinderkleding', () => {
    expect(catalogus.filter((p) => past(p, PROFIELEN['branche:bouw-en-infra'])).map((p) => p.naam)).not.toContain('Veiligheidshesje voor kinderen');
    expect(normUitNaam({ merk: 'WK', naam: 'Veiligheidshesje voor kinderen' }, 'en-iso-20471')).toBe(false);
  });

  it('herkent normen alleen aan een eenduidige naam', () => {
    expect(normUitNaam({ merk: 'Tricorp', naam: 'Parka RWS' }, 'en-iso-20471')).toBe(true);
    expect(normUitNaam({ merk: 'Hydrowear', naam: 'Hydrowear werkjas Java multistretch' }, 'en-iso-11612')).toBe(false);
    expect(normUitNaam({ merk: 'Upower', naam: 'FOREMAN o ESD 01 FO SR' }, 'en-iso-20345')).toBe(false);
  });
});
