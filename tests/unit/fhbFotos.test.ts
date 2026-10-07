import { describe, expect, it } from 'vitest';
import { fhbKleurCode, fhbPaginaUrl, fhbPaginaUrls, fhbVoorkantUit, isFhbKleurPagina } from '@/lib/kms/fhbFotos';

describe('fhbFotos', () => {
  it('leest de kleurcode uit de kleurnaam', () => {
    expect(fhbKleurCode('Antraciet/Zwart 1220')).toBe('1220');
    expect(fhbKleurCode('Antraciet 12')).toBe('12');
    expect(fhbKleurCode('Zwart')).toBeNull();
  });
  it('bouwt de pagina-URL', () => {
    expect(fhbPaginaUrl('Konrad', 'Antraciet/Zwart 1220')).toBe('https://www.fhb.de/de/produkt/konrad/1220/');
    expect(fhbPaginaUrl('Jörg', 'Zwart 20')).toBe('https://www.fhb.de/de/produkt/joerg/20/');
    expect(fhbPaginaUrl('Konrad', 'Zwart')).toBeNull();
  });
  it('probeert ook de damesvariant -f', () => {
    expect(fhbPaginaUrls('Kira', 'Marine/Zwart 1620')).toEqual([
      'https://www.fhb.de/de/produkt/kira/1620/',
      'https://www.fhb.de/de/produkt/kira-f/1620/',
    ]);
    expect(fhbPaginaUrls('Kira', 'Zwart')).toEqual([]);
  });
  it('keurt een doorverwijzing naar een ander product af', () => {
    expect(isFhbKleurPagina('https://www.fhb.de/de/produkt/kira-f/1620/', 'Marine/Zwart 1620')).toBe(true);
    expect(isFhbKleurPagina('https://www.fhb.de/de/produkt/kira-f/', 'Marine/Zwart 1620')).toBe(false);
    expect(isFhbKleurPagina('https://www.fhb.de/nl/404-foutpagina/', 'Marine/Zwart 1620')).toBe(false);
    expect(isFhbKleurPagina('https://www.fhb.de/de/produkt/kira/1012/', 'Marine/Zwart 1620')).toBe(false);
  });
  it('vindt de voorkant en negeert sfeerfoto en achterkant', () => {
    const html = `<div class="images"><img src="https://www.fhb.de/wp-content/uploads/2025/10/sfeer-860x1118.jpg" alt="image">
      <img class="x" src="https://www.fhb.de/wp-content/uploads/2025/10/b52f-860x1118.jpg" alt="Produkt Ansicht vorn" loading="lazy">
      <img src="https://www.fhb.de/wp-content/uploads/2026/06/26b4-860x1118.jpg" alt="Produkt Ansicht hinten"></div>`;
    expect(fhbVoorkantUit(html)).toBe('https://www.fhb.de/wp-content/uploads/2025/10/b52f-860x1118.jpg');
  });
  it('weigert een foto van een ander domein', () => {
    expect(fhbVoorkantUit('<img src="https://evil.example/x.jpg" alt="Produkt Ansicht vorn">')).toBeNull();
    expect(fhbVoorkantUit('<img src="/x.jpg" alt="image">')).toBeNull();
  });
});
