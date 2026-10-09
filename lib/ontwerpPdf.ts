import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

/**
 * Het werkkledingontwerp als echte PDF, in de browser gemaakt. Geen printvenster
 * meer: dat nam de hele webpagina mee (menu, balken, knoppen) en brak kaarten
 * over twee pagina's. Hier bepalen we zelf de opmaak: een kop, per kledingstuk
 * een kaart die nooit wordt afgebroken, en een voet met contactgegevens en
 * paginanummer.
 */

export type PdfStuk = {
  titel: string;
  regels: string[];
  /** JPEG of PNG als data-URL. */
  beeld: string | null;
};

export type PdfOntwerp = {
  datum: string;
  branche: string | null;
  team: string | null;
  techniek: string;
  logo: string | null;
  stukken: PdfStuk[];
  aanvullend: string[];
  prijs: { bedrag: string; toelichting: string } | null;
  contact: string | null;
  verderUrl: string | null;
  bedrijf: { naam: string; adres: string; telefoon: string; email: string; web: string };
};

const A4 = { w: 595.28, h: 841.89 };
const MARGE = 40;
const INK = rgb(0.11, 0.11, 0.11);
const WARM = rgb(0.32, 0.31, 0.31);
const LIJN = rgb(0.89, 0.88, 0.88);
const MIST = rgb(0.965, 0.96, 0.955);
const ORANJE = rgb(0.925, 0.404, 0.149);

/** Alleen tekens die de standaardletters van PDF kennen; de rest wordt netjes vervangen. */
function veilig(t: string): string {
  return t
    .replace(/[–—]/g, '-')
    .replace(/→/g, '>')
    .replace(/[^\x20-\x7e -ÿ€‘’“”•…]/g, '');
}

function afbreken(tekst: string, font: PDFFont, grootte: number, breedte: number): string[] {
  const woorden = veilig(tekst).split(/\s+/).filter(Boolean);
  const regels: string[] = [];
  let regel = '';
  for (const w of woorden) {
    const proef = regel ? `${regel} ${w}` : w;
    if (font.widthOfTextAtSize(proef, grootte) <= breedte) regel = proef;
    else {
      if (regel) regels.push(regel);
      regel = w;
    }
  }
  if (regel) regels.push(regel);
  return regels;
}

async function beeldInbedden(pdf: PDFDocument, dataUrl: string | null): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  try {
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
    if (dataUrl.startsWith('data:image/png')) return await pdf.embedPng(bytes);
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return await pdf.embedJpg(bytes);
  } catch {
    /* onleesbaar beeld: dan zonder */
  }
  return null;
}

export async function maakOntwerpPdf(o: PdfOntwerp): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Werkkledingontwerp Frederiks Bedrijfskleding');
  pdf.setAuthor(o.bedrijf.naam);
  const gewoon = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await beeldInbedden(pdf, o.logo);
  const beelden = await Promise.all(o.stukken.map((s) => beeldInbedden(pdf, s.beeld)));

  const tekst = (p: PDFPage, t: string, x: number, y: number, grootte: number, font = gewoon, kleur = INK) =>
    p.drawText(veilig(t), { x, y, size: grootte, font, color: kleur });
  const rechts = (p: PDFPage, t: string, xRechts: number, y: number, grootte: number, font = gewoon, kleur = INK) =>
    tekst(p, t, xRechts - font.widthOfTextAtSize(veilig(t), grootte), y, grootte, font, kleur);

  const binnen = A4.w - MARGE * 2;
  const VOET = 46;
  let pagina!: PDFPage;
  let y = 0;

  function nieuwePagina(eerste: boolean) {
    pagina = pdf.addPage([A4.w, A4.h]);
    if (eerste) {
      pagina.drawRectangle({ x: 0, y: A4.h - 92, width: A4.w, height: 92, color: INK });
      tekst(pagina, 'FREDERIKS', MARGE, A4.h - 48, 24, vet, rgb(1, 1, 1));
      tekst(pagina, 'B E D R I J F S K L E D I N G', MARGE + 1, A4.h - 64, 8, vet, ORANJE);
      rechts(pagina, 'Jouw werkkledingontwerp', A4.w - MARGE, A4.h - 46, 13, vet, rgb(1, 1, 1));
      rechts(pagina, o.datum, A4.w - MARGE, A4.h - 62, 9, gewoon, rgb(0.75, 0.75, 0.75));
      y = A4.h - 92 - 30;
    } else {
      tekst(pagina, 'FREDERIKS', MARGE, A4.h - 36, 12, vet);
      rechts(pagina, 'Jouw werkkledingontwerp (vervolg)', A4.w - MARGE, A4.h - 36, 9, gewoon, WARM);
      pagina.drawLine({ start: { x: MARGE, y: A4.h - 46 }, end: { x: A4.w - MARGE, y: A4.h - 46 }, thickness: 1.2, color: ORANJE, dashArray: [4, 3] });
      y = A4.h - 70;
    }
  }
  /** Ruimte vrijmaken; past het niet meer, dan een nieuwe pagina. */
  function ruimte(hoogte: number) {
    if (y - hoogte < VOET + 10) nieuwePagina(false);
  }

  nieuwePagina(true);

  // Gegevens in vier kolommen, met het logo ernaast.
  const vakken: [string, string][] = [
    ['Branche', o.branche || 'Nog niet gekozen'],
    ['Team', o.team || 'Nog niet gekozen'],
    ['Techniek', o.techniek],
    ['Logo', o.logo ? 'Aangeleverd' : 'Volgt later'],
  ];
  const logoVak = logo ? 84 : 0;
  const kolom = (binnen - logoVak) / vakken.length;
  vakken.forEach(([k, v], i) => {
    tekst(pagina, k.toUpperCase(), MARGE + i * kolom, y, 7.5, vet, WARM);
    afbreken(v, vet, 10.5, kolom - 10).slice(0, 2).forEach((r, j) => tekst(pagina, r, MARGE + i * kolom, y - 14 - j * 13, 10.5, vet));
  });
  if (logo) {
    const s = Math.min(76 / logo.width, 40 / logo.height);
    pagina.drawImage(logo, { x: A4.w - MARGE - logo.width * s, y: y - 32, width: logo.width * s, height: logo.height * s });
  }
  y -= 52;
  pagina.drawLine({ start: { x: MARGE, y }, end: { x: A4.w - MARGE, y }, thickness: 0.8, color: LIJN });
  y -= 28;

  tekst(pagina, 'Je pakket', MARGE, y, 16, vet);
  y -= 18;

  // Kaarten: twee per rij, nooit over een paginagrens.
  const GAP = 14;
  const kaartB = (binnen - GAP) / 2;
  const beeldH = 168;
  const kaartRegels = o.stukken.map((s) => {
    const titel = afbreken(s.titel, vet, 11.5, kaartB - 24);
    const sub = s.regels.flatMap((r) => afbreken(r, gewoon, 9, kaartB - 24));
    return { titel, sub };
  });
  for (let i = 0; i < o.stukken.length; i += 2) {
    const rij = [0, 1].map((k) => i + k).filter((n) => n < o.stukken.length);
    const tekstH = Math.max(...rij.map((n) => kaartRegels[n].titel.length * 14 + kaartRegels[n].sub.length * 12));
    const kaartH = 12 + beeldH + 12 + tekstH + 12;
    ruimte(kaartH + GAP);
    rij.forEach((n, k) => {
      const x = MARGE + k * (kaartB + GAP);
      const top = y;
      pagina.drawRectangle({ x, y: top - kaartH, width: kaartB, height: kaartH, borderColor: LIJN, borderWidth: 1, color: rgb(1, 1, 1) });
      pagina.drawRectangle({ x: x + 1, y: top - 12 - beeldH, width: kaartB - 2, height: beeldH + 11, color: MIST });
      const b = beelden[n];
      if (b) {
        const s = Math.min((kaartB - 24) / b.width, (beeldH - 8) / b.height);
        pagina.drawImage(b, { x: x + (kaartB - b.width * s) / 2, y: top - 8 - beeldH + (beeldH - 8 - b.height * s) / 2, width: b.width * s, height: b.height * s });
      }
      let ty = top - 12 - beeldH - 20;
      kaartRegels[n].titel.forEach((r) => { tekst(pagina, r, x + 12, ty, 11.5, vet); ty -= 14; });
      kaartRegels[n].sub.forEach((r) => { tekst(pagina, r, x + 12, ty, 9, gewoon, WARM); ty -= 12; });
    });
    y -= kaartH + GAP;
  }
  if (!o.stukken.length) {
    tekst(pagina, 'Nog geen kledingstukken gekozen.', MARGE, y - 4, 10, gewoon, WARM);
    y -= 24;
  }

  if (o.aanvullend.length) {
    ruimte(30 + o.aanvullend.length * 14);
    y -= 8;
    tekst(pagina, 'AANVULLEND', MARGE, y, 8, vet, ORANJE);
    y -= 16;
    for (const a of o.aanvullend) {
      for (const r of afbreken(`• ${a}`, gewoon, 10, binnen)) { tekst(pagina, r, MARGE, y, 10); y -= 14; }
    }
  }

  if (o.prijs) {
    const toel = afbreken(o.prijs.toelichting, gewoon, 8.5, binnen - 28);
    const h = 52 + toel.length * 11;
    ruimte(h + 16);
    y -= 10;
    pagina.drawRectangle({ x: MARGE, y: y - h, width: binnen, height: h, color: MIST });
    tekst(pagina, 'PRIJSINDICATIE', MARGE + 14, y - 18, 7.5, vet, ORANJE);
    tekst(pagina, o.prijs.bedrag, MARGE + 14, y - 36, 15, vet);
    toel.forEach((r, j) => tekst(pagina, r, MARGE + 14, y - 50 - j * 11, 8.5, gewoon, WARM));
    y -= h + 6;
  }

  // Afsluiter: wat nu.
  const slot = [
    'We denken mee, kiezen samen de juiste maten en komen langs om te passen. Je logo brengen we in eigen huis aan.',
    `Bel of app ${o.bedrijf.telefoon}, of mail ${o.bedrijf.email}.`,
  ];
  const slotRegels = slot.flatMap((s) => afbreken(s, gewoon, 9.5, binnen - 32));
  const slotH = 40 + slotRegels.length * 13 + (o.verderUrl ? 20 : 0) + (o.contact ? 16 : 0);
  ruimte(slotH + 20);
  y -= 14;
  pagina.drawRectangle({ x: MARGE, y: y - slotH, width: binnen, height: slotH, color: INK });
  tekst(pagina, 'Vraag je offerte vrijblijvend aan', MARGE + 16, y - 24, 13, vet, ORANJE);
  slotRegels.forEach((r, j) => tekst(pagina, r, MARGE + 16, y - 42 - j * 13, 9.5, gewoon, rgb(0.92, 0.92, 0.92)));
  let sy = y - 42 - slotRegels.length * 13 - 4;
  if (o.verderUrl) {
    const t = 'Klik hier om verder te gaan met je ontwerp >';
    tekst(pagina, t, MARGE + 16, sy, 10, vet, ORANJE);
    const bw = vet.widthOfTextAtSize(t, 10);
    pagina.drawLine({ start: { x: MARGE + 16, y: sy - 2 }, end: { x: MARGE + 16 + bw, y: sy - 2 }, thickness: 0.6, color: ORANJE });
    const annot = pdf.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [MARGE + 16, sy - 4, MARGE + 16 + bw, sy + 11],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(o.verderUrl) },
    });
    pagina.node.addAnnot(pdf.context.register(annot));
    sy -= 20;
  }
  if (o.contact) tekst(pagina, veilig(`Jouw gegevens: ${o.contact}`), MARGE + 16, sy, 8.5, gewoon, rgb(0.7, 0.7, 0.7));

  // Voet op elke pagina, met paginanummer.
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawLine({ start: { x: MARGE, y: 34 }, end: { x: A4.w - MARGE, y: 34 }, thickness: 0.6, color: LIJN });
    tekst(p, `${o.bedrijf.naam} · ${o.bedrijf.adres} · ${o.bedrijf.telefoon} · ${o.bedrijf.web.replace(/^https?:\/\//, '')}`, MARGE, 22, 7.5, gewoon, WARM);
    rechts(p, `Pagina ${i + 1} van ${paginas.length}`, A4.w - MARGE, 22, 7.5, gewoon, WARM);
  });

  return pdf.save();
}
