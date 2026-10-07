import { describe, it, expect } from 'vitest';
import { koppelBestand, kleurCodes, type KoppelArtikel } from '@/lib/kms/fotoKoppelen';

const konrad: KoppelArtikel = {
  id: 'k', naam: 'Poloshirt Tweekleuren', merk: 'FHB', artNr: 'Konrad',
  kleuren: [
    { kleur: 'Antraciet/Zwart 1220', heeftFoto: false },
    { kleur: 'Zwart 20', heeftFoto: false },
    { kleur: 'Wit/Antraciet 1012', heeftFoto: true },
  ],
};
const melanie: KoppelArtikel = {
  id: 'm', naam: 'Damesbroek', merk: 'FHB', artNr: 'Melanie',
  kleuren: [{ kleur: 'Antraciet 12', heeftFoto: false }, { kleur: 'Beige 13', heeftFoto: false }],
};
const alle = [konrad, melanie];

describe('foto koppelen op bestandsnaam', () => {
  it('FHB-download: artikel, kleurcode en voorkant', () => {
    const k = koppelBestand('Konrad_91490_1220_front.jpg', alle);
    expect(k.status).toBe('gevonden');
    if (k.status === 'gevonden') {
      expect(k.artikel.id).toBe('k');
      expect(k.kleur).toBe('Antraciet/Zwart 1220');
      expect(k.zijde).toBe('voor');
      expect(k.vervangt).toBe(false);
    }
  });
  it('achterkant wordt herkend', () => {
    const k = koppelBestand('Konrad_91490_1220_back.jpg', alle);
    expect(k.zijde).toBe('achter');
  });
  it('kleurcode 20 kiest niet per ongeluk 1220', () => {
    const k = koppelBestand('Konrad_91490_20_front.jpg', alle);
    expect(k.status === 'gevonden' && k.kleur).toBe('Zwart 20');
  });
  it('bestaande foto wordt gemeld als vervangen', () => {
    const k = koppelBestand('Konrad_91490_1012_front.jpg', alle);
    expect(k.status === 'gevonden' && k.vervangt).toBe(true);
  });
  it('oude naamgeving met kleurnaam werkt ook', () => {
    const k = koppelBestand('Melanie_Antraciet_12.jpg', alle);
    expect(k.status === 'gevonden' && k.kleur).toBe('Antraciet 12');
  });
  it('onbekend artikel', () => {
    expect(koppelBestand('Onbekend_123_front.jpg', alle).status).toBe('geen-artikel');
  });
  it('kleurcodes uit de naam', () => {
    expect(kleurCodes('Antraciet/Zwart 1220')).toEqual(['1220']);
  });
});
