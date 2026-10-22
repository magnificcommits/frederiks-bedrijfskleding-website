'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  staffelUitFormulier,
  verwijderFormaat,
  verwijderKosten,
  voegFormaatToe,
  voegKostenToe,
  werkFormaat,
  werkKosten,
  zetCentraleStaffel,
} from '@/lib/kms/prijslijstBeheer';

const PAD = '/dashboard/instellingen/personalisatie';
async function eis() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}
const tekst = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const getal = (fd: FormData, k: string): number | null => {
  const r = tekst(fd, k).replace(',', '.');
  if (r === '') return null;
  const n = Number(r);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function zetStaffelActie(fd: FormData) {
  await eis();
  const techniek = tekst(fd, 'techniek');
  const formaat = tekst(fd, 'formaat');
  const ok = techniek && formaat ? await zetCentraleStaffel(techniek, formaat, staffelUitFormulier(fd)) : false;
  if (ok) await logAudit('prijslijst_staffel', { entiteit: 'decoratie_tarieven', details: { techniek, formaat } });
  redirect(`${PAD}?${ok ? 'ok=staffel' : 'fout=1'}#${techniek}`);
}

export async function werkFormaatActie(fd: FormData) {
  await eis();
  const ok = await werkFormaat(tekst(fd, 'id'), { omschrijving: tekst(fd, 'omschrijving') || null, max: getal(fd, 'max') });
  redirect(`${PAD}?${ok ? 'ok=formaat' : 'fout=1'}`);
}

export async function voegFormaatActie(fd: FormData) {
  await eis();
  const ok = await voegFormaatToe({ techniek: tekst(fd, 'techniek'), formaat: tekst(fd, 'formaat'), omschrijving: tekst(fd, 'omschrijving') || null, max: getal(fd, 'max'), prijs: getal(fd, 'prijs') });
  if (ok) await logAudit('prijslijst_formaat', { entiteit: 'decoratie_formaten', details: { techniek: tekst(fd, 'techniek'), formaat: tekst(fd, 'formaat') } });
  redirect(`${PAD}?${ok ? 'ok=nieuw' : 'fout=1'}`);
}

export async function verwijderFormaatActie(fd: FormData) {
  await eis();
  const ok = await verwijderFormaat(tekst(fd, 'id'));
  redirect(`${PAD}?${ok ? 'ok=weg' : 'fout=1'}`);
}

export async function werkKostenActie(fd: FormData) {
  await eis();
  const bedrag = getal(fd, 'bedrag');
  const ok = bedrag != null ? await werkKosten(tekst(fd, 'id'), { omschrijving: tekst(fd, 'omschrijving') || null, bedrag, eenheid: tekst(fd, 'eenheid') || 'order' }) : false;
  redirect(`${PAD}?${ok ? 'ok=kosten' : 'fout=1'}#kosten`);
}

export async function voegKostenActie(fd: FormData) {
  await eis();
  const bedrag = getal(fd, 'bedrag');
  const ok = bedrag != null && tekst(fd, 'techniek') && tekst(fd, 'omschrijving')
    ? await voegKostenToe({ techniek: tekst(fd, 'techniek'), soort: tekst(fd, 'omschrijving').slice(0, 30), omschrijving: tekst(fd, 'omschrijving'), bedrag, eenheid: tekst(fd, 'eenheid') || 'order' })
    : false;
  redirect(`${PAD}?${ok ? 'ok=kosten' : 'fout=1'}#kosten`);
}

export async function verwijderKostenActie(fd: FormData) {
  await eis();
  const ok = await verwijderKosten(tekst(fd, 'id'));
  redirect(`${PAD}?${ok ? 'ok=weg' : 'fout=1'}#kosten`);
}
