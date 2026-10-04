'use server';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { aiTekst } from '@/lib/ai';
import { analyseKernCijfers } from '@/lib/kms/analyse';
import { leesPeriode } from '@/lib/kms/analysePeriode';

export type AiSamenvattingResultaat = { tekst?: string; error?: string; periode?: string };

/**
 * Vat de analyse van de gekozen periode samen in een paar concrete punten.
 * De cijfers worden hier op de server opnieuw berekend uit de periode in het
 * formulier, zodat de AI altijd dezelfde getallen ziet als de pagina en er
 * niets van de client wordt vertrouwd. De API-key blijft server-side.
 */
export async function aiSamenvattingActie(
  _prev: AiSamenvattingResultaat | null,
  formData: FormData,
): Promise<AiSamenvattingResultaat> {
  if (!(await dashAuthed())) return { error: 'Geen toegang.' };
  await eisEigenaar();

  const veld = (k: string) => {
    const v = formData.get(k);
    return typeof v === 'string' && v ? v : undefined;
  };
  const periode = leesPeriode({ periode: veld('periode'), van: veld('van'), tot: veld('tot'), vgl: veld('vgl') });

  let cijfers: Record<string, unknown>;
  try {
    cijfers = await analyseKernCijfers(periode);
  } catch {
    return { error: 'De cijfers konden niet worden opgehaald. Probeer het over een minuut opnieuw.' };
  }

  const opdracht =
    'Je bent de zakelijke sparringpartner van Jessi, eigenaar van Frederiks Bedrijfskleding, een kleine ' +
    'bedrijfskledingzaak in Hengelo (Gld) die bedrijven in de Achterhoek bedient met persoonlijk advies en passen op locatie. ' +
    `Hieronder staan de cijfers van de periode ${periode.label}` +
    (periode.vgl ? `, vergeleken met ${periode.vgl.label}` : '') +
    '. Schrijf 4 tot 6 korte punten: wat valt op, wat gaat goed, wat vraagt aandacht en één concrete actie voor deze week. ' +
    'Noem getallen. Als er weinig data is, zeg dat eerlijk en trek geen grote conclusies uit een paar orders. ' +
    'Bedragen zijn excl. btw. Null betekent: niet bekend of niet van toepassing. ' +
    'Schrijf in gewoon Nederlands, zonder inleiding, zonder gedachtestreepjes en zonder emoji. ' +
    `Cijfers (JSON): ${JSON.stringify(cijfers)}`;

  const resultaat = await aiTekst(opdracht);
  if (!resultaat.ok) return { error: resultaat.error ?? 'Er ging iets mis bij het samenvatten.' };
  return { tekst: resultaat.tekst, periode: periode.label };
}
