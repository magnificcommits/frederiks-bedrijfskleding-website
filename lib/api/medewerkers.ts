import { z } from 'zod';
import type { HrMedewerker, HrUitkomst } from '@/lib/kms/hrKoppeling';

/** Zod-schema's voor /api/v1/medewerkers, met foutmeldingen in gewone taal. */

const datum = z
  .string({ invalid_type_error: 'Gebruik een datum als tekst: JJJJ-MM-DD.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gebruik het formaat JJJJ-MM-DD, bijvoorbeeld 2026-11-01.')
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Deze datum bestaat niet.');

const tekst = (max: number) => z.string().trim().max(max, `Maximaal ${max} tekens.`);
const optTekst = (max: number) => tekst(max).nullable().optional();
const pnr = z
  .string()
  .trim()
  .min(1, 'Personeelsnummer mag niet leeg zijn.')
  .max(40, 'Maximaal 40 tekens.')
  .regex(/^[A-Za-z0-9._-]+$/, 'Alleen letters, cijfers, punt, streepje en underscore.');

export const inDienstSchema = z
  .object({
    naam: tekst(160).min(1, 'Naam is verplicht.'),
    voornaam: optTekst(80),
    achternaam: optTekst(120),
    email: z.string().trim().email('Dit is geen geldig e-mailadres.').max(200).nullable().optional(),
    personeelsnummer: pnr.nullable().optional(),
    afdeling: optTekst(120),
    functie: optTekst(120),
    startdatum: datum.nullable().optional(),
  })
  .strict()
  .refine((v) => !!v.personeelsnummer || !!v.email, {
    message: 'Geef een personeelsnummer of e-mailadres mee, zodat we de medewerker later terugvinden.',
    path: ['personeelsnummer'],
  });

export const wijzigSchema = z
  .object({
    naam: tekst(160).min(1, 'Naam mag niet leeg zijn.').optional(),
    voornaam: optTekst(80),
    achternaam: optTekst(120),
    email: z.string().trim().email('Dit is geen geldig e-mailadres.').max(200).nullable().optional(),
    personeelsnummer: pnr.optional(),
    afdeling: optTekst(120),
    functie: optTekst(120),
    startdatum: datum.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Stuur minstens één veld mee om te wijzigen.' });

export const uitDienstSchema = z
  .object({
    einddatum: datum.optional(),
  })
  .strict();

export const lijstQuerySchema = z.object({
  status: z.enum(['in_dienst', 'uit_dienst', 'alle']).default('alle'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  gewijzigd_sinds: z.string().datetime({ offset: true, message: 'Gebruik een ISO-tijdstip, bijvoorbeeld 2026-10-01T00:00:00Z.' }).optional(),
});

export const pnrSchema = pnr;

/** Hoe een medewerker in de API terugkomt. Interne id's laten we buiten de API. */
export function medewerkerJson(m: HrMedewerker) {
  return {
    personeelsnummer: m.personeelsnummer,
    naam: m.naam,
    email: m.email,
    afdeling: m.afdeling,
    functie: m.functie,
    startdatum: m.startdatum,
    einddatum: m.einddatum,
    status: m.status,
    bron: m.bron,
    bijgewerkt_op: m.bijgewerkt_op,
  };
}

export function uitkomstJson(u: HrUitkomst) {
  return {
    resultaat: u.resultaat,
    medewerker: medewerkerJson(u.medewerker),
    ...(u.waarschuwingen.length ? { waarschuwingen: u.waarschuwingen } : {}),
  };
}

/** Personeelsnummer uit het pad; een kapotte %-codering geeft gewoon de ruwe tekst (die dan niet door de validatie komt). */
export function pnrUitPad(ruw: string): string {
  try {
    return decodeURIComponent(ruw);
  } catch {
    return ruw;
  }
}
