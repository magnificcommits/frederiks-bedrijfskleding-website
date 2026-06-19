import { env, isAiConfigured } from '@/lib/env';

/**
 * Dunne AI-laag bovenop de OpenAI Chat Completions API.
 * Env-gated: zonder OPENAI_API_KEY doet dit niets (geeft nette fout terug
 * in plaats van te crashen). ALLEEN server-side gebruiken (deze module wordt
 * alleen aangeroepen vanuit een 'use server' action) — de key mag NOOIT naar
 * de client lekken.
 */

const STANDAARD_SYSTEEM =
  'Je bent een behulpzame Nederlandse marketing- en kledingexpert voor een ' +
  'bedrijfskledingleverancier. Schrijf concreet, menselijk, zonder overdreven verkooptaal.';

export async function aiTekst(
  opdracht: string,
  opties?: { systeem?: string; model?: string },
): Promise<{ ok: boolean; tekst?: string; error?: string }> {
  if (!isAiConfigured) {
    return {
      ok: false,
      error: 'AI is nog niet geconfigureerd. Zet OPENAI_API_KEY in de omgevingsvariabelen.',
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: opties?.model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: opties?.systeem ?? STANDAARD_SYSTEEM },
          { role: 'user', content: opdracht },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        error: `AI-aanvraag mislukt (${res.status}). ${detail.slice(0, 300)}`.trim(),
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const tekst = data?.choices?.[0]?.message?.content?.trim();

    if (!tekst) {
      return { ok: false, error: 'AI gaf geen tekst terug. Probeer het opnieuw.' };
    }

    return { ok: true, tekst };
  } catch (err) {
    const bericht = err instanceof Error ? err.message : 'onbekende fout';
    return { ok: false, error: `Kon de AI niet bereiken: ${bericht}` };
  }
}
