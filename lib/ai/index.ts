import { env, isAiConfigured } from '@/lib/env';

/**
 * Dunne AI-laag bovenop de Anthropic (Claude) Messages API.
 * Env-gated: zonder ANTHROPIC_API_KEY doet dit niets (geeft een nette fout terug
 * in plaats van te crashen). ALLEEN server-side gebruiken (deze module wordt
 * alleen aangeroepen vanuit een 'use server' action) — de key mag NOOIT naar
 * de client lekken.
 */

const STANDAARD_SYSTEEM =
  'Je bent een behulpzame Nederlandse marketing- en kledingexpert voor een ' +
  'bedrijfskledingleverancier. Schrijf concreet, menselijk, zonder overdreven verkooptaal.';

const STANDAARD_MODEL = 'claude-sonnet-4-6';

export async function aiTekst(
  opdracht: string,
  opties?: { systeem?: string; model?: string },
): Promise<{ ok: boolean; tekst?: string; error?: string }> {
  if (!isAiConfigured) {
    return {
      ok: false,
      error: 'AI is nog niet geconfigureerd. Zet ANTHROPIC_API_KEY in de omgevingsvariabelen.',
    };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opties?.model ?? STANDAARD_MODEL,
        max_tokens: 1500,
        temperature: 0.7,
        system: opties?.systeem ?? STANDAARD_SYSTEEM,
        messages: [{ role: 'user', content: opdracht }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        error: `AI-aanvraag mislukt (${res.status}). ${detail.slice(0, 300)}`.trim(),
      };
    }

    const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const tekst = data?.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();

    if (!tekst) {
      return { ok: false, error: 'AI gaf geen tekst terug. Probeer het opnieuw.' };
    }

    return { ok: true, tekst };
  } catch (err) {
    const bericht = err instanceof Error ? err.message : 'onbekende fout';
    return { ok: false, error: `Kon de AI niet bereiken: ${bericht}` };
  }
}
