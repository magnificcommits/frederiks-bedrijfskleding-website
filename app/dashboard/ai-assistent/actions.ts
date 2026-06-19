'use server';
import { dashAuthed } from '@/lib/kms/adminClient';
import { isAiConfigured } from '@/lib/env';
import { aiTekst } from '@/lib/ai';

export type AiResultaat = { tekst?: string; error?: string };

/**
 * Status voor de client: of de beheerder is ingelogd en of de AI-key is gezet.
 * Wordt server-side bepaald, zodat de geheime key nooit in de client belandt.
 */
export async function aiStatusActie(): Promise<{ authed: boolean; aiAan: boolean }> {
  return { authed: await dashAuthed(), aiAan: isAiConfigured };
}

type Soort = 'kennisbank' | 'product' | 'email' | 'rapportage';

const prompts: Record<Soort, { systeem: string; opbouw: (onderwerp: string) => string }> = {
  kennisbank: {
    systeem:
      'Je bent een Nederlandse contentredacteur voor een bedrijfskledingleverancier. ' +
      'Schrijf een helder, behulpzaam kennisbankartikel met een korte intro, een paar ' +
      'tussenkoppen en concrete, praktische informatie. Geen overdreven verkooptaal.',
    opbouw: (o) => `Schrijf een kennisbankartikel over: ${o}`,
  },
  product: {
    systeem:
      'Je bent een Nederlandse productcopywriter voor werk- en bedrijfskleding. ' +
      'Schrijf een wervende maar eerlijke productbeschrijving: noem materiaal, pasvorm, ' +
      'gebruik en onderhoud waar relevant. Concreet en menselijk, geen holle superlatieven.',
    opbouw: (o) => `Schrijf een productbeschrijving voor: ${o}`,
  },
  email: {
    systeem:
      'Je bent een Nederlandse accountmanager bij een bedrijfskledingleverancier. ' +
      'Schrijf een persoonlijke, vriendelijke en professionele klant-e-mail. ' +
      'Houd het kort en concreet, met een duidelijke vervolgstap. Nederlandse aanhef en afsluiting.',
    opbouw: (o) => `Schrijf een klant-e-mail over: ${o}`,
  },
  rapportage: {
    systeem:
      'Je bent een Nederlandse business-analist. Vat de aangeleverde informatie of ' +
      'het onderwerp bondig samen in een zakelijke rapportage-samenvatting met de ' +
      'belangrijkste punten en, waar mogelijk, een korte conclusie of aanbeveling.',
    opbouw: (o) => `Maak een rapportage-samenvatting van het volgende:\n\n${o}`,
  },
};

export async function genereerActie(
  _prev: AiResultaat | null,
  formData: FormData,
): Promise<AiResultaat> {
  if (!(await dashAuthed())) {
    return { error: 'Niet ingelogd. Log opnieuw in via het dashboard.' };
  }

  const soortRaw = String(formData.get('soort') ?? '');
  const onderwerp = String(formData.get('onderwerp') ?? '').trim();

  if (!onderwerp) {
    return { error: 'Vul een onderwerp of instructie in.' };
  }

  const soort: Soort = (['kennisbank', 'product', 'email', 'rapportage'] as const).includes(
    soortRaw as Soort,
  )
    ? (soortRaw as Soort)
    : 'kennisbank';

  const config = prompts[soort];
  const resultaat = await aiTekst(config.opbouw(onderwerp), { systeem: config.systeem });

  if (!resultaat.ok) {
    return { error: resultaat.error ?? 'Er ging iets mis bij het genereren.' };
  }
  return { tekst: resultaat.tekst };
}
